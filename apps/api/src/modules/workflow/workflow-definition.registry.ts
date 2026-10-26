import { WorkflowDefinition } from '@ai-corp/shared-types';
import { SemanticVersion } from '../../domain/workflow/SemanticVersion';
import { WorkflowGraph } from '../../domain/workflow/WorkflowGraph';
import { canonicalJson } from '../../domain/workflow/canonicalJson';
import { DefinitionLookup, WorkflowValidator } from './workflow-validator';

export class WorkflowVersionConflictError extends Error {
  constructor(readonly definitionId: string, readonly version: string) {
    super(
      `Workflow ${definitionId}@${version} is already registered with different content. ` +
      'Definitions are immutable per version: bump the version instead.'
    );
    this.name = 'WorkflowVersionConflictError';
  }
}

/**
 * In-memory catalogue of workflow definitions, keyed by id and version (Task 17).
 *
 * - A definition is immutable once registered: the same id@version with other content is rejected,
 *   the same content again is a no-op. Runs pin the version they started with, so changing a
 *   workflow never changes runs already in flight.
 * - Sub-workflow references without a version are pinned to the latest registered version at
 *   registration time, so a parent always runs the child it was validated against. Because a
 *   referenced child must already exist, reference cycles can't form (a direct self-reference is
 *   rejected by the validator).
 * - "Latest" is the highest SemVer precedence; among equal precedence (template builds such as
 *   1.0.0+a and 1.0.0+b) the one registered last.
 */
export class WorkflowDefinitionRegistry implements DefinitionLookup {
  private readonly versions = new Map<string, Map<string, WorkflowDefinition>>();
  private readonly registrationOrder: string[] = [];

  register(input: WorkflowDefinition): WorkflowDefinition {
    const definition = this.pinSubWorkflowVersions({ ...input, version: input.version || '1.0.0' });
    WorkflowValidator.validate(definition, this);

    const existing = this.get(definition.id, definition.version);
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(definition)) {
        throw new WorkflowVersionConflictError(definition.id, definition.version);
      }
      return existing;
    }

    // Store a frozen copy: nobody can change a registered version through a reference
    const stored = WorkflowDefinitionRegistry.deepFreeze(JSON.parse(JSON.stringify(definition)) as WorkflowDefinition);
    const byVersion = this.versions.get(definition.id) || new Map<string, WorkflowDefinition>();
    byVersion.set(stored.version, stored);
    this.versions.set(stored.id, byVersion);
    this.registrationOrder.push(WorkflowDefinitionRegistry.key(stored.id, stored.version));
    return stored;
  }

  get(id: string, version?: string | null): WorkflowDefinition | undefined {
    const byVersion = this.versions.get(id);
    if (!byVersion) return undefined;
    if (version) return byVersion.get(version);
    return this.latest(id);
  }

  latest(id: string): WorkflowDefinition | undefined {
    const byVersion = this.versions.get(id);
    if (!byVersion || byVersion.size === 0) return undefined;
    let best: WorkflowDefinition | undefined;
    let bestOrder = -1;
    for (const def of byVersion.values()) {
      const order = this.registrationOrder.indexOf(WorkflowDefinitionRegistry.key(def.id, def.version));
      if (!best) {
        best = def;
        bestOrder = order;
        continue;
      }
      const cmp = SemanticVersion.parse(def.version).compareTo(SemanticVersion.parse(best.version));
      if (cmp > 0 || (cmp === 0 && order > bestOrder)) {
        best = def;
        bestOrder = order;
      }
    }
    return best;
  }

  /** Every registered version of a definition, oldest first */
  versionsOf(id: string): WorkflowDefinition[] {
    return [...(this.versions.get(id)?.values() || [])].sort((a, b) =>
      SemanticVersion.parse(a.version).compareTo(SemanticVersion.parse(b.version))
    );
  }

  /** Latest version of every definition */
  list(): WorkflowDefinition[] {
    return [...this.versions.keys()].map(id => this.latest(id)!).filter(Boolean);
  }

  private pinSubWorkflowVersions(def: WorkflowDefinition): WorkflowDefinition {
    if (new WorkflowGraph(def).subWorkflowReferences().length === 0) return def;
    return {
      ...def,
      nodes: def.nodes.map(node => {
        if (node.type !== 'sub_workflow' || node.subWorkflowVersion || !node.subWorkflowId) return node;
        const latest = node.subWorkflowId === def.id ? undefined : this.latest(node.subWorkflowId);
        return latest ? { ...node, subWorkflowVersion: latest.version } : node;
      }),
    };
  }

  static key(id: string, version: string): string {
    return `${id}@${version}`;
  }

  private static deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(v => WorkflowDefinitionRegistry.deepFreeze(v));
      Object.freeze(value);
    }
    return value;
  }
}
