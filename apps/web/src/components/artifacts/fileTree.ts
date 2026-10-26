import type { ArtifactFile, ArtifactKind } from '../../lib/api/hooks/artifacts';

export interface FileTreeNode {
  /** Folder keys start with "dir:", file keys are the file path */
  key: string;
  title: string;
  isLeaf: boolean;
  kind?: ArtifactKind;
  size?: number;
  children?: FileTreeNode[];
}

/** Builds a folder tree from flat project-relative paths: folders first, then files, each sorted by name */
export function buildFileTree(files: Pick<ArtifactFile, 'path' | 'kind' | 'size'>[]): FileTreeNode[] {
  const root: FileTreeNode = { key: 'dir:', title: '', isLeaf: false, children: [] };
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let node = root;
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      if (isLast) {
        node.children!.push({ key: file.path, title: part, isLeaf: true, kind: file.kind, size: file.size });
        return;
      }
      const key = `dir:${parts.slice(0, index + 1).join('/')}`;
      let child = node.children!.find(c => c.key === key);
      if (!child) {
        child = { key, title: part, isLeaf: false, children: [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: FileTreeNode[]): FileTreeNode[] =>
    nodes
      .sort((a, b) => (a.isLeaf === b.isLeaf ? a.title.localeCompare(b.title) : a.isLeaf ? 1 : -1))
      .map(n => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children!);
}

/** Folder keys of the tree, for expanding everything by default */
export function folderKeys(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap(n => (n.isLeaf ? [] : [n.key, ...folderKeys(n.children || [])]));
}

/** The file opened first: the OOAD evidence in reading order, else the first Markdown file, else the first file */
export function defaultFile(files: Pick<ArtifactFile, 'path' | 'kind'>[]): string | null {
  const preferred = ['docs/use-cases.md', 'docs/architecture-patterns.md', 'docs/traceability-matrix.md', 'ARCHITECTURE.md'];
  const paths = new Set(files.map(f => f.path));
  return preferred.find(p => paths.has(p)) || files.find(f => f.kind === 'markdown')?.path || files[0]?.path || null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
