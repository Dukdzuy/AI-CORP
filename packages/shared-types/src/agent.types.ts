// Agent types for AI Corp Platform

export enum AgentRole {
  CEO = 'CEO',
  PM = 'PM',
  DEV = 'DEV',
  QA = 'QA',
  MARKETING = 'MARKETING',
}

export interface AgentContext {
  task: string;
  taskId?: string;
  projectId?: string;
  workflowRunId?: string;
  projectContext: Record<string, unknown>;
  relevantMemories: AgentMemory[];
  availableTools: ToolDefinition[];
  variables?: Record<string, unknown>;
}

export interface AgentThought {
  reasoning: string;
  plannedActions: AgentAction[];
  confidence: number;
}

export interface AgentAction {
  toolName: string;
  parameters: Record<string, unknown>;
  rationale: string;
}

export interface AgentMemory {
  id: string;
  agentRole: AgentRole;
  namespace: string;
  content: string;
  embedding?: number[];
  importance: number;
  timestamp: Date;
  tags?: string[];
  projectId?: string;
}

export interface MemoryMetadata {
  projectId?: string;
  importance: number;
  tags?: string[];
}

export interface ModelRouteConfig {
  provider: string;
  model: string;
  fallbackProvider?: string;
  tags?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler?: Function;
  requiresSandbox?: boolean;
  timeout?: number;
  resourceLimits?: ResourceLimits;
}

export interface ToolRoleAccess {
  toolName: string;
  allowedRoles: AgentRole[];
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCPUPercent: number;
  maxDiskMB: number;
  maxNetworkKBps?: number;
  timeout?: number;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
  resourceUsage: {
    memoryMB: number;
    cpuPercent: number;
  };
}

// LLM Provider Types

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  content: string;
  requestedModel: string;
  actualModelUsed: string;
  actualProvider: string;
  isFallbackTriggered: boolean;
  tokenUsage: TokenUsage;
  rtkTokenSaved?: number;
  toolCalls?: ToolCall[];
}

export interface ILLMProvider {
  chat(params: ChatParams): Promise<ChatResult>;
  validateConfig(): Promise<boolean>;
  getProviderName(): string;
}
