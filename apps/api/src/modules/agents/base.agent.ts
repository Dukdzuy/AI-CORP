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
import { IThinkingStrategy } from '../../domain/agent/interfaces/IThinkingStrategy.interface';
import { IActionStrategy } from '../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext } from '../../domain/common/types';
import { AgentStateMachine } from '../../domain/agent/AgentStateMachine';
import { AgentEventEmitter } from '../../domain/agent/AgentEventEmitter';
import { AgentState } from '../../domain/agent/AgentState';
import { StateChangedEvent } from '../../domain/agent/interfaces/IAgentObserver.interface';

export abstract class BaseAgent {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly stateMachine: AgentStateMachine;
  protected readonly eventEmitter: AgentEventEmitter;

  constructor(
    protected readonly role: AgentRole,
    protected readonly systemPrompt: string,
    protected readonly modelConfig: ModelRouteConfig,
    protected readonly memoryService: MemoryService,
    protected readonly llmFactory: LLMProviderFactory,
    protected readonly toolRegistry: ToolRegistry,
    protected readonly sandboxExecutor: SandboxExecutor,
    protected readonly apiUsageService: ApiUsageService,
    protected readonly websocketGateway: AppWebSocketGateway,
    protected readonly thinkingStrategy?: IThinkingStrategy,
    protected readonly actionStrategy?: IActionStrategy,
    stateMachine?: AgentStateMachine,
    eventEmitter?: AgentEventEmitter
  ) {
    // Initialize state machine and event emitter (create new instances if not provided)
    this.stateMachine = stateMachine || new AgentStateMachine(AgentState.IDLE);
    this.eventEmitter = eventEmitter || new AgentEventEmitter();
  }

  /**
   * Agents must implement their specific thinking process (backward compatibility)
   */
  abstract think(context: any): Promise<any>;

  /**
   * Agents must implement their specific action execution (backward compatibility)
   */
  abstract act(context: any): Promise<any>;

  /**
   * Execute the thought and action cycle.
   * Uses Strategy Pattern if strategies are injected, falls back to abstract methods otherwise.
   * Integrates AgentStateMachine for state transitions following the State Pattern.
   * 
   * State Flow:
   * - IDLE → THINKING (before thinkingStrategy.think())
   * - THINKING → ACTING (after think(), before actionStrategy.act())
   * - ACTING → COMPLETED (after successful act())
   * - Any state → ERROR (on exception)
   * - ERROR → IDLE (reset after logging error)
   */
  async execute(context: any): Promise<any> {
    const projectId = context.projectId || context.projectContext?.id || 'unknown';
    const agentId = this.role; // Using role as agentId for now

    try {
      // State transition: IDLE → THINKING
      this.stateMachine.transitionTo(AgentState.THINKING, 'Starting thought process');
      this.emitStateChanged(agentId, AgentState.IDLE, AgentState.THINKING, projectId);
      
      // Use Strategy Pattern if strategies are injected
      if (this.thinkingStrategy && this.actionStrategy) {
        const agentContext = context as AgentContext;
        
        // Execute thinking phase
        const thought = await this.thinkingStrategy.think(agentContext);
        this.emitThinking(agentContext.projectId || 'unknown', thought.reasoning);
        
        // State transition: THINKING → ACTING
        this.stateMachine.transitionTo(AgentState.ACTING, 'Executing action based on thought');
        this.emitStateChanged(agentId, AgentState.THINKING, AgentState.ACTING, projectId);
        
        // Execute action phase
        const action = await this.actionStrategy.act(agentContext, thought);
        
        // State transition: ACTING → COMPLETED
        this.stateMachine.transitionTo(AgentState.COMPLETED, 'Task completed successfully');
        this.emitStateChanged(agentId, AgentState.ACTING, AgentState.COMPLETED, projectId);
        
        // Reset to IDLE for reuse
        this.stateMachine.transitionTo(AgentState.IDLE, 'Agent ready for next task');
        this.emitStateChanged(agentId, AgentState.COMPLETED, AgentState.IDLE, projectId);
        
        return { thought, action };
      }
      
      // Fall back to existing behavior for backward compatibility
      const thought = await this.think(context);
      
      // State transition: THINKING → ACTING
      this.stateMachine.transitionTo(AgentState.ACTING, 'Executing action');
      this.emitStateChanged(agentId, AgentState.THINKING, AgentState.ACTING, projectId);
      
      const action = await this.act(context);
      
      // State transition: ACTING → COMPLETED
      this.stateMachine.transitionTo(AgentState.COMPLETED, 'Task completed successfully');
      this.emitStateChanged(agentId, AgentState.ACTING, AgentState.COMPLETED, projectId);
      
      // Reset to IDLE for reuse
      this.stateMachine.transitionTo(AgentState.IDLE, 'Agent ready for next task');
      this.emitStateChanged(agentId, AgentState.COMPLETED, AgentState.IDLE, projectId);
      
      return { thought, action };
    } catch (error) {
      // State transition: Any state → ERROR
      const currentState = this.stateMachine.getCurrentState();
      this.stateMachine.transitionTo(AgentState.ERROR, `Error during execution: ${error instanceof Error ? error.message : String(error)}`);
      this.emitStateChanged(agentId, currentState, AgentState.ERROR, projectId);
      
      // Emit error event via AgentEventEmitter
      this.eventEmitter.emitError({
        agentId,
        agentRole: this.role,
        taskId: context.taskId,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
        context: { projectId, currentState: currentState.toString() }
      });
      
      // Log error
      this.logger.error(`Agent ${this.role} execution error: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      
      // Reset to IDLE so agent can be reused
      this.stateMachine.transitionTo(AgentState.IDLE, 'Agent reset after error');
      this.emitStateChanged(agentId, AgentState.ERROR, AgentState.IDLE, projectId);
      
      // Re-throw the error so callers know it failed
      throw error;
    }
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
    // Also broadcast to all clients for VirtualOffice
    this.websocketGateway.broadcastEvent({ type: 'agent:thinking', payload: event });
  }

  /**
   * Emit a state change event via AgentEventEmitter and WebSocket
   * 
   * @param agentId - Agent identifier
   * @param previousState - State before transition
   * @param currentState - State after transition
   * @param projectId - Project context
   * @param reason - Optional reason for transition
   */
  protected emitStateChanged(
    agentId: string,
    previousState: AgentState,
    currentState: AgentState,
    projectId: string,
    reason?: string
  ) {
    const event: StateChangedEvent = {
      agentId,
      agentRole: this.role,
      previousState,
      currentState,
      timestamp: new Date(),
      reason
    };

    // Emit via AgentEventEmitter (for observers)
    this.eventEmitter.emitStateChanged(event);

    // Emit via WebSocket for real-time UI updates
    this.websocketGateway.sendToProject(projectId, {
      type: 'agent:state_changed',
      payload: event
    });

    // Also broadcast to all clients for VirtualOffice
    this.websocketGateway.broadcastEvent({
      type: 'agent:state_changed',
      payload: event
    });

    // Log state transition for debugging
    this.logger.debug(`Agent ${this.role} state: ${previousState} → ${currentState}${reason ? ` (${reason})` : ''}`);
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
    // Also broadcast to all clients for VirtualOffice
    this.websocketGateway.broadcastEvent({ type: 'agent:action', payload: event });
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
    // Look up actual agent UUID from database
    const agentId = await this.memoryService.getAgentIdByRole(this.role);
    if (!agentId) {
      this.logger.warn(`No agent found for role '${this.role}', skipping memory save`);
      return 'skipped-no-agent';
    }
    return this.memoryService.saveMemory(agentId, this.role, namespace, content, metadata);
  }

  /**
   * Invoke the LLM Gateway.
   * Reads model config from DB (PATCH /api/models/:role) before each call,
   * falling back to the hardcoded constructor value.
   */
  protected async callLLM(params: Omit<ChatParams, 'model'>, projectId?: string): Promise<ChatResult> {
    // Fetch latest model config from DB (user may have changed it via UI)
    const modelConfig = await this.memoryService.getModelConfigForAgent(this.role, this.modelConfig);

    const provider = this.llmFactory.getProvider(modelConfig);
    const startTime = Date.now();
    
    try {
      const fullParams: ChatParams = { ...params, model: modelConfig.model };
      
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
        requestedModel: modelConfig.model,
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
        requestedModel: modelConfig.model,
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
   * Execute an arbitrary shell command in the sandbox (bypasses tool registry)
   */
  protected async executeSandboxCommand(command: string, limits?: ResourceLimits): Promise<ToolResult> {
    const defaultLimits: ResourceLimits = limits || {
      maxMemoryMB: 256,
      maxCPUPercent: 50,
      maxDiskMB: 100,
      timeout: 30000
    };
    return this.sandboxExecutor.executeInSandbox('custom_command', command, defaultLimits);
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
