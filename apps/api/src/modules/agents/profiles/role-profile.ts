import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

export interface RoleProfileProps {
  role: AgentRole;
  displayName: string;
  /** Persona sent as the system message of every LLM call the role makes (also seeded into Agent.systemPrompt) */
  systemPrompt: string;
  /** Model used when Agent Settings has no saved config for the role */
  defaultModel: ModelRouteConfig;
  /** Memory namespaces the role reads and writes; the first one is the primary namespace */
  memoryNamespaces: string[];
  /** Workflow task types the role can perform; the first one is the default */
  taskTypes: string[];
}

/**
 * RoleProfile
 *
 * The per-role defaults of an agent (identity, persona, default model, memory namespaces,
 * supported task types) in one immutable object. Agent classes, their strategies and the
 * database seed all read the same profile, so adding or changing a role touches one file.
 *
 * @pattern Value Object
 * @principle Single source of truth, Open/Closed (a new role = a new profile)
 */
export class RoleProfile {
  readonly role: AgentRole;
  readonly displayName: string;
  readonly systemPrompt: string;
  readonly defaultModel: Readonly<ModelRouteConfig>;
  readonly memoryNamespaces: readonly string[];
  readonly taskTypes: readonly string[];

  private constructor(props: RoleProfileProps) {
    this.role = props.role;
    this.displayName = props.displayName;
    this.systemPrompt = props.systemPrompt;
    this.defaultModel = Object.freeze(RoleProfile.copyModel(props.defaultModel));
    this.memoryNamespaces = Object.freeze([...props.memoryNamespaces]);
    this.taskTypes = Object.freeze([...props.taskTypes]);
    Object.freeze(this);
  }

  static create(props: RoleProfileProps): RoleProfile {
    if (!props.role) throw new Error('RoleProfile requires a role');
    if (!props.displayName?.trim()) throw new Error(`RoleProfile ${props.role} requires a display name`);
    if (!props.systemPrompt?.trim()) throw new Error(`RoleProfile ${props.role} requires a system prompt`);
    if (!props.defaultModel?.provider || !props.defaultModel?.model) {
      throw new Error(`RoleProfile ${props.role} requires a default model (provider and model)`);
    }
    if (!props.memoryNamespaces?.length) throw new Error(`RoleProfile ${props.role} requires at least one memory namespace`);
    if (!props.taskTypes?.length) throw new Error(`RoleProfile ${props.role} requires at least one task type`);
    return new RoleProfile(props);
  }

  /** Namespace the role's strategies search and save to by default */
  get primaryNamespace(): string {
    return this.memoryNamespaces[0];
  }

  /** Task type used when the workflow node does not name one */
  get defaultTaskType(): string {
    return this.taskTypes[0];
  }

  supportsTaskType(taskType: string | undefined): boolean {
    return !!taskType && this.taskTypes.includes(taskType);
  }

  /** The workflow's task type if this role supports it, otherwise the role's default */
  resolveTaskType(taskType: string | undefined): string {
    return this.supportsTaskType(taskType) ? (taskType as string) : this.defaultTaskType;
  }

  /** Plain model config copy, safe to hand to the LLM layer or Prisma */
  modelConfig(): ModelRouteConfig {
    return RoleProfile.copyModel(this.defaultModel);
  }

  equals(other: RoleProfile): boolean {
    return other instanceof RoleProfile && other.role === this.role;
  }

  private static copyModel(config: ModelRouteConfig): ModelRouteConfig {
    const copy: ModelRouteConfig = { provider: config.provider, model: config.model };
    if (config.fallbackProvider) copy.fallbackProvider = config.fallbackProvider;
    if (config.tags) copy.tags = [...config.tags];
    return copy;
  }
}
