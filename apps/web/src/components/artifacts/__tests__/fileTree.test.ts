import { describe, expect, it } from 'vitest';
import { buildFileTree, defaultFile, folderKeys, formatSize } from '../fileTree';

const files = [
  { path: 'tests/UC-001.spec.ts', kind: 'code' as const, size: 10 },
  { path: 'docs/use-cases.md', kind: 'markdown' as const, size: 20 },
  { path: 'src/domain/entities/Order.ts', kind: 'code' as const, size: 30 },
  { path: 'package.json', kind: 'json' as const, size: 40 },
  { path: 'docs/class-diagram.puml', kind: 'plantuml' as const, size: 50 },
  { path: 'src/application/services/OrderService.ts', kind: 'code' as const, size: 60 },
];

describe('buildFileTree', () => {
  it('nests paths into folders, folders before files, sorted by name', () => {
    const tree = buildFileTree(files);
    expect(tree.map(n => n.title)).toEqual(['docs', 'src', 'tests', 'package.json']);
    expect(tree[0].children!.map(n => n.key)).toEqual(['docs/class-diagram.puml', 'docs/use-cases.md']);
    expect(tree[1].children!.map(n => n.title)).toEqual(['application', 'domain']);
    expect(tree[1].children![1].children![0].children![0]).toEqual({
      key: 'src/domain/entities/Order.ts', title: 'Order.ts', isLeaf: true, kind: 'code', size: 30,
    });
  });

  it('lists every folder key for default expansion', () => {
    expect(folderKeys(buildFileTree(files))).toEqual([
      'dir:docs', 'dir:src', 'dir:src/application', 'dir:src/application/services', 'dir:src/domain', 'dir:src/domain/entities', 'dir:tests',
    ]);
  });

  it('returns an empty tree for no files', () => {
    expect(buildFileTree([])).toEqual([]);
  });
});

describe('defaultFile', () => {
  it('opens the use cases first, then any Markdown, then the first file', () => {
    expect(defaultFile(files)).toBe('docs/use-cases.md');
    expect(defaultFile([{ path: 'src/a.ts', kind: 'code' }, { path: 'README.md', kind: 'markdown' }])).toBe('README.md');
    expect(defaultFile([{ path: 'src/a.ts', kind: 'code' }])).toBe('src/a.ts');
    expect(defaultFile([])).toBeNull();
  });
});

describe('formatSize', () => {
  it('uses B, KB and MB', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(2048)).toBe('2.0 KB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
