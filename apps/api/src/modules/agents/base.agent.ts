import { Logger } from '@nestjs/common';
import { AgentRole, ChatParams, ChatResult, ToolDefinition, ResourceLimits, ToolResult, ModelRouteConfig } from '@ai-corp/shared-types';
import { MemoryService, MemoryMetadata, MemorySearchResult } from '../memory/memory.service';
import { LLMProviderFactory } from '../llm/llm-provider.factory';
import { ToolRegistry } from '../tools/tool.registry';
import { SandboxExecutor } from '../tools/sandbox.executor';
import { ApiUsageService } from '../llm/api-usage.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { AgentThinkingEvent, AgentActionEvent, AgentMessageEvent, WebSocketEventType } from '@ai-corp/shared-types';
import { sanitizeUserInput, sanitizeToolOutput } from '../security/input-sanitizer';
import { validateParameters } from '../security/parameter-validator';

export abstract class BaseAgent {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly role: AgentRole,
    protected readonly systemPrompt: string,
    protected readonly modelConfig: ModelRouteConfig,
    protected readonly memoryService: MemoryService,
    protected readonly llmFactory: LLMProviderFactory,
    protected readonly toolRegistry: ToolRegistry,
    protected readonly sandboxExecutor: SandboxExecutor,
    protected readonly apiUsageService: ApiUsageService,
    protected readonly websocketGateway: AppWebSocketGateway
  ) {}

  /**
   * Agents must implement their specific thinking process
   */
  abstract think(context: any): Promise<any>;

  /**
   * Agents must implement their specific action execution
   */
  abstract act(context: any): Promise<any>;

  /**
   * Execute the thought and action cycle.
   */
  async execute(context: any): Promise<any> {
    const thought = await this.think(context);
    const action = await this.act(context);
    return { thought, action };
  }

  /**
   * Emit an agent thinking event
   */
  protected emitThinking(projectId: string, thought: string) {
    const event: AgentThinkingEvent = {
      agentId: this.role,
      agentRole: this.role,
      taskId: 'unknown',
      message: thought,
    } as any;
    this.websocketGateway.sendToProject(projectId, { type: 'agent:thinking', payload: event });
  }

  /**
   * Emit an agent action event
   */
  protected emitAction(projectId: string, taskId: string, actionType: string, toolName: string, parameters: any = {}) {
    const event: AgentActionEvent = {
      agentId: this.role,
      agentRole: this.role,
      taskId,
      actionType,
      toolName,
      parameters
    };
    this.websocketGateway.sendToProject(projectId, { type: 'agent:action', payload: event });
  }

  /**
   * Emit an agent message event
   */
  protected emitMessage(projectId: string, message: string, toAgent: AgentRole | 'all' = 'all') {
    const event: AgentMessageEvent = {
      agentId: this.role,
      agentRole: this.role,
      fromAgent: this.role,
      toAgent,
      message,
      messageType: 'chat',
      timestamp: new Date()
    };
    this.websocketGateway.sendToProject(projectId, { type: 'agent:message', payload: event });
  }

  /**
   * Load context-relevant memories using the vector database
   */
  protected async loadMemory(namespace: string, query: string, limit = 5): Promise<MemorySearchResult[]> {
    return this.memoryService.searchMemories(this.role, namespace, query, limit);
  }

  /**
   * Save a new memory observation to the vector database
   */
  protected async saveMemory(namespace: string, content: string, importance: number = 5, projectId?: string): Promise<string> {
    const metadata: MemoryMetadata = { importance, projectId };
    // Assuming agentId is a known context or we pass it
    // For now we use the role as agentId in this abstract base since agentId might be tied to DB instance
    return this.memoryService.saveMemory('agent-instance-' + this.role, this.role, namespace, content, metadata);
  }

  /**
   * Invoke the LLM Gateway
   */
  protected async callLLM(params: Omit<ChatParams, 'model'>, projectId?: string): Promise<ChatResult> {
    const provider = this.llmFactory.getProvider(this.modelConfig);
    const startTime = Date.now();
    
    try {
      const fullParams: ChatParams = { ...params, model: this.modelConfig.model };
      
      // Inject system prompt if not present
      if (!fullParams.messages.some(m => m.role === 'system')) {
        fullParams.messages.unshift({ role: 'system', content: this.systemPrompt });
      }

      // Sanitize all message contents to prevent prompt injection
      fullParams.messages = fullParams.messages.map(msg => ({
        ...msg,
        content: sanitizeUserInput(msg.content)
      }));

      const result = await provider.chat(fullParams);
      const responseTimeMs = Date.now() - startTime;

      // Structured logging for LLM call
      this.logger.log(JSON.stringify({
        event: 'llm_call',
        agentRole: this.role,
        projectId,
        requestedModel: this.modelConfig.model,
        actualModelUsed: result.actualModelUsed,
        actualProvider: result.actualProvider,
        isFallbackTriggered: result.isFallbackTriggered,
        promptTokens: result.tokenUsage.promptTokens,
        completionTokens: result.tokenUsage.completionTokens,
        totalTokens: result.tokenUsage.totalTokens,
        rtkTokenSaved: result.rtkTokenSaved,
        responseTimeMs,
      }));

      // Log API usage for cost tracking
      await this.apiUsageService.logUsage({
        projectId,
        agentRole: this.role,
        requestedModel: this.modelConfig.model,
        actualModelUsed: result.actualModelUsed,
        actualProvider: result.actualProvider,
        isFallbackTriggered: result.isFallbackTriggered,
        promptTokens: result.tokenUsage.promptTokens,
        completionTokens: result.tokenUsage.completionTokens,
        rtkTokenSaved: result.rtkTokenSaved,
        responseTimeMs,
      });

      return result;
    } catch (error) {
      this.logger.error(`LLM call failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Execute a tool in the isolated Sandbox
   */
  protected async executeTool(toolName: string, command: string, params: Record<string, unknown> = {}, customLimits?: ResourceLimits): Promise<ToolResult> {
    // 1. Check if tool exists and agent has access
    if (!this.toolRegistry.isToolAuthorizedForRole(toolName, this.role)) {
      throw new Error(`Tool '${toolName}' is not authorized for role '${this.role}'`);
    }

    const toolDef = this.toolRegistry.getTool(toolName);
    if (!toolDef) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // 2. Validate parameters against tool schema
    if (toolDef.parameters && Object.keys(params).length > 0) {
      const validation = validateParameters(params, toolDef.parameters, toolName);
      if (!validation.valid) {
        throw new Error(`Parameter validation failed: ${validation.errors.join('; ')}`);
      }
    }

    if (!toolDef.requiresSandbox) {
      // Execute outside sandbox (e.g. create_milestone which just hits DB)
      return { success: true, output: `Executed ${toolName} without sandbox`, executionTimeMs: 10, resourceUsage: { memoryMB: 0, cpuPercent: 0 } };
    }

    const limits = customLimits || toolDef.resourceLimits || {
      maxMemoryMB: 256,
      maxCPUPercent: 50,
      maxDiskMB: 100,
      timeout: toolDef.timeout || 30000
    };

    const result = await this.sandboxExecutor.executeInSandbox(toolName, command, limits);
    // Sanitize tool output to prevent injection in subsequent LLM calls
    return {
      ...result,
      output: sanitizeToolOutput(result.output, toolName)
    };
  }
}
