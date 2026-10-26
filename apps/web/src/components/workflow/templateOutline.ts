import { InstantiatedWorkflow, WorkflowDefinition, WorkflowTemplateParameter } from '@ai-corp/shared-types';

export interface OutlineRow {
  key: string;
  label: string;
  type: string;
  role?: string;
  depth: number;
}

/** Nodes in execution order along the main path (start → … → end), then any nodes off that path */
function orderedNodes(def: WorkflowDefinition) {
  const order: string[] = [];
  let current: string | undefined = def.startNode;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    order.push(current);
    const out = def.edges.filter(e => e.from === current);
    const forward = out.find(e => !e.condition) || out.find(e => e.condition === 'onSuccess' || e.condition === 'onApprove');
    current = forward?.to;
  }
  const parallelBranches = new Set(
    def.nodes.flatMap(n => (n.type === 'parallel' ? (((n.metadata as any)?.branches || []) as Array<{ nodeId: string }>).map(b => b.nodeId) : []))
  );
  return order
    .map(id => def.nodes.find(n => n.id === id)!)
    .filter(Boolean)
    .concat(def.nodes.filter(n => !seen.has(n.id) && !parallelBranches.has(n.id)));
}

/**
 * What a template instance will run, as an indented outline: sub-workflow nodes list the nodes of
 * the sub-workflow they run, parallel nodes list their branches.
 */
export function templateOutline(instance: InstantiatedWorkflow): OutlineRow[] {
  const subs = new Map(instance.subWorkflows.map(s => [`${s.id}@${s.version}`, s]));
  const rows: OutlineRow[] = [];

  const walk = (def: WorkflowDefinition, depth: number, prefix: string) => {
    for (const node of orderedNodes(def)) {
      const key = `${prefix}/${node.id}`;
      rows.push({ key, label: node.id, type: node.type, role: node.agentRole, depth });
      if (node.type === 'sub_workflow') {
        const sub = subs.get(`${node.subWorkflowId}@${node.subWorkflowVersion}`);
        if (sub) walk(sub, depth + 1, key);
      }
      if (node.type === 'parallel') {
        for (const branch of ((node.metadata as any)?.branches || []) as Array<{ nodeId: string }>) {
          const branchNode = def.nodes.find(n => n.id === branch.nodeId);
          rows.push({ key: `${key}/${branch.nodeId}`, label: branch.nodeId, type: branchNode?.type || 'agent_task', role: branchNode?.agentRole, depth: depth + 1 });
        }
      }
    }
  };
  walk(instance.definition, 0, instance.definition.id);
  return rows;
}

/** Defaults of a template's parameters, for the form's initial values */
export function parameterDefaults(parameters: WorkflowTemplateParameter[]): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const p of parameters) {
    if (p.defaultValue !== undefined) values[p.name] = p.defaultValue;
  }
  return values;
}
