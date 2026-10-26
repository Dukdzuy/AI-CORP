import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * ProjectWorkspace
 *
 * Persistent file store for the projects the agents generate (docs, skeleton, code, tests).
 * Each project lives under <PROJECTS_WORKSPACE_DIR>/projects/<projectId>/.
 *
 * The Docker sandbox runs every command in a fresh container with no bind mounts, so files
 * written there disappear with the container. Agents write and read project files here
 * instead; the sandbox stays for running commands.
 *
 * Every path is resolved inside the project's folder: absolute paths and `..` are rejected.
 *
 * @pattern Repository (for generated-project files)
 */
@Injectable()
export class ProjectWorkspace {
  private readonly logger = new Logger(ProjectWorkspace.name);
  private readonly root: string;

  constructor(root?: string) {
    this.root = path.resolve(root || process.env.PROJECTS_WORKSPACE_DIR || path.join(process.cwd(), 'workspace'));
  }

  /** Path of a project file as agents report it, e.g. projects/<id>/docs/use-cases.md */
  static displayPath(projectId: string, relativePath: string): string {
    return `projects/${projectId}/${relativePath}`;
  }

  projectDir(projectId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
      throw new Error(`Invalid project id for workspace: ${projectId}`);
    }
    return path.join(this.root, 'projects', projectId);
  }

  /**
   * Normalise a path given relative to the project root. Accepts paths that already start with
   * projects/<projectId>/ (as the LLM often echoes them). Returns null for unsafe paths.
   */
  normalize(projectId: string, relativePath: string): string | null {
    let clean = relativePath.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    const prefix = `projects/${projectId}/`;
    if (clean.startsWith(prefix)) clean = clean.slice(prefix.length);
    if (!clean || clean.startsWith('/') || /^[A-Za-z]:/.test(clean) || clean.split('/').includes('..')) {
      return null;
    }
    return path.posix.normalize(clean);
  }

  private resolve(projectId: string, relativePath: string): string {
    const clean = this.normalize(projectId, relativePath);
    if (!clean) {
      throw new Error(`Unsafe project file path: ${relativePath}`);
    }
    const dir = this.projectDir(projectId);
    const full = path.resolve(dir, clean);
    if (full !== dir && !full.startsWith(dir + path.sep)) {
      throw new Error(`Path escapes the project workspace: ${relativePath}`);
    }
    return full;
  }

  async writeFile(projectId: string, relativePath: string, content: string): Promise<string> {
    const full = this.resolve(projectId, relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    return ProjectWorkspace.displayPath(projectId, this.normalize(projectId, relativePath)!);
  }

  async readFile(projectId: string, relativePath: string): Promise<string | null> {
    try {
      return await fs.readFile(this.resolve(projectId, relativePath), 'utf8');
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }
  }

  async exists(projectId: string, relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(projectId, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  /** All files under a project folder (or one of its subfolders), as paths relative to the project root */
  async listFiles(projectId: string, subdir = ''): Promise<string[]> {
    const base = subdir ? this.resolve(projectId, subdir) : this.projectDir(projectId);
    const projectDir = this.projectDir(projectId);
    const files: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries: import('fs').Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (err: any) {
        if (err?.code === 'ENOENT') return;
        throw err;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') await walk(full);
        } else if (entry.isFile()) {
          files.push(path.relative(projectDir, full).split(path.sep).join('/'));
        }
      }
    };
    await walk(base);
    return files.sort();
  }
}
