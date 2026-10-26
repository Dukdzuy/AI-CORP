import { WorkflowDefinition } from '@ai-corp/shared-types';
import { SemanticVersion } from '../../../src/domain/workflow/SemanticVersion';
import { WorkflowGraph } from '../../../src/domain/workflow/WorkflowGraph';
import { CyclicDependencyError, DependencyResolver } from '../../../src/domain/workflow/DependencyResolver';
import { WorkflowRunMemento } from '../../../src/domain/workflow/WorkflowRunMemento';
import { canonicalJson, contentHash } from '../../../src/domain/workflow/canonicalJson';

describe('SemanticVersion (Task 17)', () => {
  it('parses MAJOR.MINOR.PATCH with optional build metadata', () => {
    const v = SemanticVersion.parse('2.1.3+abc123');
    expect([v.major, v.minor, v.patch, v.build]).toEqual([2, 1, 3, 'abc123']);
    expect(v.toString()).toBe('2.1.3+abc123');
    expect(SemanticVersion.parse('1.0.0').withBuild('ff').toString()).toBe('1.0.0+ff');
  });

  it('rejects malformed versions', () => {
    expect(() => SemanticVersion.parse('1.0')).toThrow(/Invalid workflow version/);
    expect(SemanticVersion.isValid('v1.0.0')).toBe(false);
  });

  it('orders by precedence and ignores build metadata', () => {
    const cmp = (a: string, b: string) => Math.sign(SemanticVersion.parse(a).compareTo(SemanticVersion.parse(b)));
    expect(cmp('1.10.0', '1.9.9')).toBe(1);
    expect(cmp('1.0.0', '2.0.0')).toBe(-1);
    expect(cmp('1.0.0+a', '1.0.0+b')).toBe(0);
  });
});

describe('WorkflowGraph', () => {
  const def: WorkflowDefinition = {
    id: 'g', name: 'g', version: '1.0.0', startNode: 'a', endNode: 'check',
    nodes: [
      { id: 'a', type: 'agent_task' },
      { id: 'b', type: 'agent_task' },
      { id: 'check', type: 'condition' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'check' },
      { from: 'check', to: 'a', condition: 'onFail' },
    ],
  };
  const graph = new WorkflowGraph(def);

  it('follows a single unconditional edge', () => {
    expect(graph.next('a', 'onSuccess')).toEqual({ kind: 'next', nodeId: 'b' });
  });

  it('lets the end node loop back on its condition and completes otherwise', () => {
    expect(graph.next('check', 'onFail')).toEqual({ kind: 'next', nodeId: 'a' });
    expect(graph.next('check', 'onSuccess')).toEqual({ kind: 'complete' });
  });

  it('only follows an explicit onFail edge after a failure', () => {
    expect(graph.nextAfterFailure('a').kind).toBe('dead_end');
    expect(graph.nextAfterFailure('check')).toEqual({ kind: 'next', nodeId: 'a' });
  });
});

describe('DependencyResolver (Task 18)', () => {
  it('groups branches in topological layers', () => {
    const resolver = new DependencyResolver([
      { nodeId: 'deploy', dependsOn: ['build', 'docs'] },
      { nodeId: 'build' },
      { nodeId: 'test', dependsOn: ['build'] },
      { nodeId: 'docs' },
    ]);
    expect(resolver.layers()).toEqual([['build', 'docs'], ['test', 'deploy']]);
    expect(resolver.layerOf().get('deploy')).toBe(1);
  });

  it('reports the branches that form a cycle', () => {
    const resolver = new DependencyResolver([
      { nodeId: 'a', dependsOn: ['c'] },
      { nodeId: 'b', dependsOn: ['a'] },
      { nodeId: 'c', dependsOn: ['b'] },
      { nodeId: 'free' },
    ]);
    expect(() => resolver.layers()).toThrow(CyclicDependencyError);
    try {
      resolver.layers();
    } catch (error) {
      expect((error as CyclicDependencyError).nodeIds.sort()).toEqual(['a', 'b', 'c']);
    }
  });

  it('rejects self-dependencies, unknown dependencies and duplicates', () => {
    expect(() => new DependencyResolver([{ nodeId: 'a', dependsOn: ['a'] }])).toThrow(CyclicDependencyError);
    expect(() => new DependencyResolver([{ nodeId: 'a', dependsOn: ['zzz'] }])).toThrow(/unknown branch zzz/);
    expect(() => new DependencyResolver([{ nodeId: 'a' }, { nodeId: 'a' }])).toThrow(/listed twice/);
  });

  it('lists the branches that are ready to start', () => {
    const resolver = new DependencyResolver([{ nodeId: 'a' }, { nodeId: 'b', dependsOn: ['a'] }]);
    expect(resolver.ready(new Set(), new Set())).toEqual(['a']);
    expect(resolver.ready(new Set(['a']), new Set(['a']))).toEqual(['b']);
  });
});

describe('WorkflowRunMemento (Task 17)', () => {
  it('keeps its own copy of the context', () => {
    const run = { id: 'r1', currentNodeId: 'design', status: 'running', context: { variables: { n: 1, list: [1] } } };
    const memento = WorkflowRunMemento.capture(run, 3);
    run.context.variables.n = 99;
    run.context.variables.list.push(2);

    const restored = memento.context() as any;
    expect(restored.variables).toEqual({ n: 1, list: [1] });
    restored.variables.n = 42;
    expect((memento.context() as any).variables.n).toBe(1);
    expect(memento.toPrimitives()).toEqual(expect.objectContaining({ workflowRunId: 'r1', sequence: 3, nodeId: 'design' }));
  });

  it('needs a current node', () => {
    expect(() => WorkflowRunMemento.capture({ id: 'r', currentNodeId: null, status: 'running', context: {} }, 1)).toThrow();
  });
});

describe('canonicalJson', () => {
  it('ignores key order and undefined properties', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(canonicalJson({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 }));
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
});
