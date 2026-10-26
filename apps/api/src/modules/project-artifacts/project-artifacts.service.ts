import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectWorkspace } from '../workspace/project-workspace.service';
import { ZipWriter } from './zip-writer';

export type ArtifactKind = 'markdown' | 'plantuml' | 'code' | 'json' | 'text';

export interface ArtifactFile {
  path: string;
  size: number;
  kind: ArtifactKind;
  modifiedAt: string;
}

export interface ArtifactContent extends ArtifactFile {
  content: string;
}

export interface QualityGateRecord {
  id: string;
  gateId: string;
  passed: boolean;
  score: number;
  checklist: Array<{ name: string; actual?: unknown; expected?: unknown; passed: boolean }>;
  timestamp: string;
}

/**
 * ProjectArtifactsService
 *
 * Read-only view of a generated project for the UI: file list, file content, zip archive and
 * the OOAD quality gate history. Files are read only through ProjectWorkspace, which confines
 * every path to projects/<id>/.
 */
@Injectable()
export class ProjectArtifactsService {
  /** Larger files are offered through the archive only */
  static readonly MAX_FILE_BYTES = 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: ProjectWorkspace
  ) {}

  static kindOf(filePath: string): ArtifactKind {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.md')) return 'markdown';
    if (lower.endsWith('.puml') || lower.endsWith('.plantuml')) return 'plantuml';
    if (lower.endsWith('.json')) return 'json';
    if (/\.(ts|tsx|js|jsx|mjs|cjs|hbs|css|html|ya?ml|sql|sh)$/.test(lower)) return 'code';
    return 'text';
  }

  async listFiles(projectId: string): Promise<{ projectId: string; files: ArtifactFile[]; totalSize: number }> {
    await this.ensureProject(projectId);
    const files: ArtifactFile[] = [];
    for (const filePath of await this.workspace.listFiles(projectId)) {
      const info = await this.workspace.stat(projectId, filePath);
      if (!info) continue;
      files.push({
        path: filePath,
        size: info.size,
        kind: ProjectArtifactsService.kindOf(filePath),
        modifiedAt: info.modifiedAt.toISOString(),
      });
    }
    return { projectId, files, totalSize: files.reduce((n, f) => n + f.size, 0) };
  }

  async readFile(projectId: string, filePath: string): Promise<ArtifactContent> {
    await this.ensureProject(projectId);
    const clean = this.workspace.normalize(projectId, filePath || '');
    if (!clean) {
      throw new BadRequestException(`Invalid file path: ${filePath}`);
    }
    const info = await this.workspace.stat(projectId, clean);
    if (!info) {
      throw new NotFoundException(`File not found: ${clean}`);
    }
    if (info.size > ProjectArtifactsService.MAX_FILE_BYTES) {
      throw new PayloadTooLargeException(`File is larger than ${ProjectArtifactsService.MAX_FILE_BYTES} bytes; download the archive`);
    }
    const content = (await this.workspace.readFile(projectId, clean)) ?? '';
    return {
      path: clean,
      size: info.size,
      kind: ProjectArtifactsService.kindOf(clean),
      modifiedAt: info.modifiedAt.toISOString(),
      content,
    };
  }

  /** Zip of the whole project folder (node_modules excluded), entries under <project-slug>/ */
  async archive(projectId: string): Promise<{ fileName: string; buffer: Buffer; fileCount: number }> {
    const project = await this.ensureProject(projectId);
    const slug = ProjectArtifactsService.slug(project.name) || projectId;
    const zip = new ZipWriter();
    for (const filePath of await this.workspace.listFiles(projectId)) {
      const data = await this.workspace.readBuffer(projectId, filePath);
      const info = await this.workspace.stat(projectId, filePath);
      if (data && info) zip.addFile(`${slug}/${filePath}`, data, info.modifiedAt);
    }
    if (zip.size === 0) {
      throw new NotFoundException(`Project ${projectId} has no generated files yet`);
    }
    return { fileName: `${slug}.zip`, buffer: zip.toBuffer(), fileCount: zip.size };
  }

  async qualityGates(projectId: string, limit = 20): Promise<QualityGateRecord[]> {
    await this.ensureProject(projectId);
    const logs = await this.prisma.qualityGateLog.findMany({
      where: { projectId },
      orderBy: { timestamp: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return logs.map(log => {
      const checklist = Array.isArray(log.checklist) ? (log.checklist as QualityGateRecord['checklist']) : [];
      const passedCount = checklist.filter(item => item?.passed).length;
      return {
        id: log.id,
        gateId: log.gateId,
        passed: log.passed,
        score: checklist.length ? Math.round((passedCount / checklist.length) * 100) : 0,
        checklist,
        timestamp: log.timestamp.toISOString(),
      };
    });
  }

  static slug(name: string): string {
    return (name || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private async ensureProject(projectId: string): Promise<{ id: string; name: string }> {
    if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
    if (!project) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }
    return project;
  }
}
