import {
  InstantiatedWorkflow,
  WorkflowDefinition,
  WorkflowTemplateCategory,
  WorkflowTemplateParameter,
  WorkflowTemplateSummary,
} from '@ai-corp/shared-types';
import { SemanticVersion } from './SemanticVersion';
import { contentHash } from './canonicalJson';

export type TemplateParameterValues = Record<string, string | number | boolean>;

export class TemplateParameterError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid template parameters: ${problems.join('; ')}`);
    this.name = 'TemplateParameterError';
  }
}

/**
 * A reusable workflow template (Task 19).
 *
 * Template Method: instantiate() validates and normalises the parameters, asks the subclass to
 * build() the definitions, then stamps every definition with the template version plus a build
 * tag derived from its content ("1.0.0+5c1e0a2b").
 *
 * Subclasses build definitions from typed values instead of replacing "${param}" strings in JSON,
 * so a parameter can switch whole nodes on or off, not only change text.
 *
 * @pattern Template Method
 */
export abstract class WorkflowTemplate {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: WorkflowTemplateCategory;
  abstract readonly version: string;
  abstract readonly parameters: WorkflowTemplateParameter[];

  /** Build the main definition and its sub-workflows from validated parameters */
  protected abstract build(params: TemplateParameterValues): { definition: WorkflowDefinition; subWorkflows: WorkflowDefinition[] };

  summary(): WorkflowTemplateSummary {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      version: this.version,
      parameters: this.parameters,
    };
  }

  instantiate(input: Record<string, unknown> = {}): InstantiatedWorkflow {
    const params = this.resolveParameters(input);
    const built = this.build(params);
    const base = SemanticVersion.parse(this.version);

    // Sub-workflows first: the main definition pins their versions, so its hash covers them too
    const subVersions = new Map<string, string>();
    const subWorkflows = built.subWorkflows.map(sub => {
      const stamped = WorkflowTemplate.stamp(sub, base, subVersions);
      subVersions.set(stamped.id, stamped.version);
      return stamped;
    });

    return {
      templateId: this.id,
      parameters: params,
      definition: WorkflowTemplate.stamp(built.definition, base, subVersions),
      subWorkflows,
    };
  }

  /**
   * Pin sub-workflow references, then version the definition as <template version>+<content hash>:
   * equal content always gets the same version (instantiating twice registers nothing new) and
   * different content never shares one, even across templates that reuse a sub-workflow.
   */
  private static stamp(def: WorkflowDefinition, base: SemanticVersion, subVersions: Map<string, string>): WorkflowDefinition {
    const pinned: WorkflowDefinition = {
      ...def,
      version: base.toString(),
      nodes: def.nodes.map(node =>
        node.type === 'sub_workflow' && node.subWorkflowId && subVersions.has(node.subWorkflowId)
          ? { ...node, subWorkflowVersion: subVersions.get(node.subWorkflowId) }
          : node
      ),
    };
    return { ...pinned, version: base.withBuild(contentHash(pinned)).toString() };
  }

  /** Apply defaults, coerce form values ("3", "true") and check types, ranges and options */
  resolveParameters(input: Record<string, unknown>): TemplateParameterValues {
    const problems: string[] = [];
    const resolved: TemplateParameterValues = {};
    const known = new Set(this.parameters.map(p => p.name));

    for (const name of Object.keys(input || {})) {
      if (!known.has(name)) problems.push(`unknown parameter '${name}'`);
    }

    for (const param of this.parameters) {
      const raw = input?.[param.name];
      const missing = raw === undefined || raw === null || raw === '';
      if (missing) {
        if (param.defaultValue !== undefined) resolved[param.name] = param.defaultValue;
        else if (param.required) problems.push(`'${param.name}' is required`);
        continue;
      }
      const value = WorkflowTemplate.coerce(param, raw, problems);
      if (value !== undefined) resolved[param.name] = value;
    }

    if (problems.length > 0) throw new TemplateParameterError(problems);
    return resolved;
  }

  private static coerce(param: WorkflowTemplateParameter, raw: unknown, problems: string[]): string | number | boolean | undefined {
    switch (param.type) {
      case 'number': {
        const value = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(value)) {
          problems.push(`'${param.name}' must be a number`);
          return undefined;
        }
        if (param.min !== undefined && value < param.min) problems.push(`'${param.name}' must be >= ${param.min}`);
        if (param.max !== undefined && value > param.max) problems.push(`'${param.name}' must be <= ${param.max}`);
        return value;
      }
      case 'boolean':
        if (typeof raw === 'boolean') return raw;
        if (raw === 'true' || raw === 'false') return raw === 'true';
        problems.push(`'${param.name}' must be true or false`);
        return undefined;
      case 'enum':
        if (!param.options?.includes(String(raw))) {
          problems.push(`'${param.name}' must be one of ${(param.options || []).join(', ')}`);
          return undefined;
        }
        return String(raw);
      case 'string': {
        const value = String(raw).trim();
        if (value.length > 200) problems.push(`'${param.name}' must be at most 200 characters`);
        return value;
      }
    }
  }
}
