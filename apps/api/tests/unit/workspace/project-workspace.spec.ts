import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectWorkspace } from '../../../src/modules/workspace/project-workspace.service';

describe('ProjectWorkspace', () => {
  let dir: string;
  let workspace: ProjectWorkspace;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-'));
    workspace = new ProjectWorkspace(dir);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('persists files under projects/<id>/ and lists them recursively', async () => {
    expect(await workspace.writeFile('p1', 'docs/use-cases.md', '# UC')).toBe('projects/p1/docs/use-cases.md');
    await workspace.writeFile('p1', 'projects/p1/src/domain/Order.ts', 'class Order {}');

    expect(fs.readFileSync(path.join(dir, 'projects/p1/docs/use-cases.md'), 'utf8')).toBe('# UC');
    expect(await workspace.readFile('p1', 'src/domain/Order.ts')).toBe('class Order {}');
    expect(await workspace.exists('p1', 'docs/use-cases.md')).toBe(true);
    expect(await workspace.listFiles('p1')).toEqual(['docs/use-cases.md', 'src/domain/Order.ts']);
    expect(await workspace.listFiles('p1', 'docs')).toEqual(['docs/use-cases.md']);
  });

  it('returns null / false / [] for files and projects that do not exist', async () => {
    expect(await workspace.readFile('p2', 'docs/none.md')).toBeNull();
    expect(await workspace.exists('p2', 'docs/none.md')).toBe(false);
    expect(await workspace.listFiles('p2')).toEqual([]);
  });

  it('rejects paths that escape the project folder', async () => {
    expect(workspace.normalize('p1', '../p2/x.ts')).toBeNull();
    expect(workspace.normalize('p1', '/etc/passwd')).toBeNull();
    expect(workspace.normalize('p1', 'src/../../x.ts')).toBeNull();
    await expect(workspace.writeFile('p1', '../../evil.ts', 'x')).rejects.toThrow('Unsafe project file path');
    await expect(workspace.writeFile('../p1', 'a.ts', 'x')).rejects.toThrow('Invalid project id');
  });
});
