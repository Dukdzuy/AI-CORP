import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { inflateRawSync } from 'zlib';
import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../../src/modules/auth/guards/jwt-auth.guard';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ProjectWorkspace } from '../../../src/modules/workspace/project-workspace.service';
import { ProjectArtifactsController } from '../../../src/modules/project-artifacts/project-artifacts.controller';
import { ProjectArtifactsService } from '../../../src/modules/project-artifacts/project-artifacts.service';
import { crc32, ZipWriter } from '../../../src/modules/project-artifacts/zip-writer';

/** Reads a zip through its central directory and checks every entry's CRC */
function readZip(buffer: Buffer): Record<string, string> {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(buffer.readUInt32LE(offset)).toBe(0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const localNameLength = buffer.readUInt16LE(local + 26);
    const data = buffer.subarray(local + 30 + localNameLength, local + 30 + localNameLength + compressedSize);
    const content = method === 8 ? inflateRawSync(data) : data;
    expect(crc32(content)).toBe(crc);
    files[name] = content.toString('utf8');
    offset += 46 + nameLength;
  }
  return files;
}

class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.headers.authorization !== 'Bearer test') throw new UnauthorizedException();
    return true;
  }
}

describe('ZipWriter', () => {
  it('writes stored and deflated entries that inflate back with valid CRCs', () => {
    const zip = new ZipWriter()
      .addFile('a/readme.md', Buffer.from('# Title\n'.repeat(50)))
      .addFile('a/x.txt', Buffer.from('x'));
    const files = readZip(zip.toBuffer());
    expect(files).toEqual({ 'a/readme.md': '# Title\n'.repeat(50), 'a/x.txt': 'x' });
  });

  it('rejects entry names that escape the archive', () => {
    expect(() => new ZipWriter().addFile('../evil', Buffer.from(''))).toThrow(/Unsafe zip entry/);
  });

  it('computes the standard CRC-32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });
});

describe('ProjectArtifactsController', () => {
  const projectId = 'p1';
  let app: INestApplication;
  let base: string;
  let root: string;
  const prisma = {
    project: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === projectId ? { id: projectId, name: 'Book Shop (Đặt hàng)' } : null)),
    },
    qualityGateLog: {
      findMany: jest.fn(async () => [
        {
          id: 'g1', gateId: 'ooad_gate', passed: false, timestamp: new Date('2026-10-26T10:00:00Z'),
          checklist: [
            { name: 'Use cases', actual: 6, expected: '>= 5', passed: true },
            { name: 'Artifact: docs/class-diagram.puml', actual: 'missing', expected: 'exists', passed: false },
          ],
        },
      ]),
    },
  };

  const get = (url: string, auth = true) =>
    fetch(`${base}${url}`, { headers: auth ? { Authorization: 'Bearer test' } : {} });

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifacts-'));
    const workspace = new ProjectWorkspace(root);
    await workspace.writeFile(projectId, 'docs/use-cases.md', '# Use Cases\n');
    await workspace.writeFile(projectId, 'docs/class-diagram.puml', '@startuml\nclass Order\n@enduml\n');
    await workspace.writeFile(projectId, 'src/domain/entities/Order.ts', 'export class Order {}\n');
    await workspace.writeFile(projectId, 'tests/UC-001.spec.ts', "describe('UC-001: Place Order', () => {});\n");
    fs.writeFileSync(path.join(root, 'secret.txt'), 'outside the project');
    fs.mkdirSync(path.join(root, 'projects', projectId, 'node_modules', 'x'), { recursive: true });
    fs.writeFileSync(path.join(root, 'projects', projectId, 'node_modules', 'x', 'index.js'), '');

    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectArtifactsController],
      providers: [
        ProjectArtifactsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectWorkspace, useValue: workspace },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderAuthGuard)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api`.replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('is protected by the JWT guard', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectArtifactsController)).toContain(JwtAuthGuard);
    expect((await get(`/projects/${projectId}/files`, false)).status).toBe(401);
    expect((await get(`/projects/${projectId}/archive`, false)).status).toBe(401);
  });

  it('lists the project files with kind and size, without node_modules', async () => {
    const res = await get(`/projects/${projectId}/files`);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.files.map((f: any) => [f.path, f.kind])).toEqual([
      ['docs/class-diagram.puml', 'plantuml'],
      ['docs/use-cases.md', 'markdown'],
      ['src/domain/entities/Order.ts', 'code'],
      ['tests/UC-001.spec.ts', 'code'],
    ]);
    expect(body.files[1].size).toBe('# Use Cases\n'.length);
  });

  it('returns a file by its path', async () => {
    const res = await get(`/projects/${projectId}/files/src/domain/entities/Order.ts`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({
      path: 'src/domain/entities/Order.ts', kind: 'code', content: 'export class Order {}\n',
    }));
  });

  it('rejects path traversal', async () => {
    // fetch folds %2e%2e into a dot segment before sending, so this one never reaches the route
    const dotted = await get(`/projects/${projectId}/files/%2e%2e/%2e%2e/secret.txt`);
    expect(dotted.status).toBe(404);
    expect(await dotted.text()).not.toContain('outside the project');
    // Encoded slashes reach the route as one parameter containing '..'
    expect((await get(`/projects/${projectId}/files/docs%2f..%2f..%2f..%2fsecret.txt`)).status).toBe(400);
    const service = app.get(ProjectArtifactsService);
    await expect(service.readFile(projectId, '../secret.txt')).rejects.toThrow(/Invalid file path/);
    await expect(service.readFile(projectId, '/etc/passwd')).rejects.toThrow(/Invalid file path/);
  });

  it('returns 404 for an unknown project or file', async () => {
    expect((await get('/projects/nope/files')).status).toBe(404);
    expect((await get('/projects/nope/archive')).status).toBe(404);
    expect((await get(`/projects/${projectId}/files/docs/missing.md`)).status).toBe(404);
    expect((await get(`/projects/${projectId}/files/docs`)).status).toBe(404);
  });

  it('downloads a zip with docs/, src/ and tests/', async () => {
    const res = await get(`/projects/${projectId}/archive`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="book-shop-at-hang.zip"');

    const files = readZip(Buffer.from(await res.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual([
      'book-shop-at-hang/docs/class-diagram.puml',
      'book-shop-at-hang/docs/use-cases.md',
      'book-shop-at-hang/src/domain/entities/Order.ts',
      'book-shop-at-hang/tests/UC-001.spec.ts',
    ]);
    expect(files['book-shop-at-hang/tests/UC-001.spec.ts']).toContain('UC-001: Place Order');
  });

  it('returns the quality gate history with a score', async () => {
    const res = await get(`/projects/${projectId}/quality-gates`);
    expect(res.status).toBe(200);
    const [gate] = (await res.json()) as any[];
    expect(gate).toEqual(expect.objectContaining({ gateId: 'ooad_gate', passed: false, score: 50, timestamp: '2026-10-26T10:00:00.000Z' }));
    expect(gate.checklist).toHaveLength(2);
  });

  it('classifies artifact kinds', () => {
    expect(ProjectArtifactsService.kindOf('docs/ARCHITECTURE.md')).toBe('markdown');
    expect(ProjectArtifactsService.kindOf('docs/x.plantuml')).toBe('plantuml');
    expect(ProjectArtifactsService.kindOf('package.json')).toBe('json');
    expect(ProjectArtifactsService.kindOf('jest.config.js')).toBe('code');
    expect(ProjectArtifactsService.kindOf('LICENSE')).toBe('text');
  });
});
