/**
 * Thinking Strategy Implementations
 * 
 * Concrete implementations of IThinkingStrategy for different agent roles.
 * Implements the Strategy Pattern for flexible thinking behavior.
 * 
 * Design Pattern: Strategy Pattern (Gang of Four)
 * SOLID Principles:
 * - SRP: Each strategy focused on one agent role's thinking style
 * - OCP: New strategies can be added without modifying existing ones
 * - LSP: All strategies can be substituted for IThinkingStrategy
 * - ISP: Implements focused IThinkingStrategy interface
 * - DIP: Depends on IThinkingStrategy abstraction
 * 
 * @module domain/agent/strategies/ThinkingStrategy
 */

import { AgentRole } from '@ai-corp/shared-types';
import {
  IThinkingStrategy,
} from '../interfaces/IThinkingStrategy.interface';
import {
  AgentContext,
  AgentThought,
  AgentAction,
} from '../../common/types';

/**
 * Base Thinking Strategy
 * 
 * Abstract base class providing common functionality for all thinking strategies.
 * Template Method Pattern: defines skeleton, subclasses fill in specifics.
 */
export abstract class BaseThinkingStrategy implements IThinkingStrategy {
  /**
   * Execute the thinking strategy
   * Template method that validates context and delegates to specific implementation
   */
  async think(context: AgentContext): Promise<AgentThought> {
    // Validate context
    this.validateContext(context);

    // Delegate to specific implementation
    return await this.generateThought(context);
  }

  /**
   * Validate agent context
   * Ensures required fields are present
   */
  protected validateContext(context: AgentContext): void {
    if (!context) {
      throw new Error('Context is required for thinking strategy');
    }
    if (!context.task) {
      throw new Error('Task is required in context for thinking strategy');
    }
    if (!context.projectId) {
      throw new Error('ProjectId is required in context for thinking strategy');
    }
  }

  /**
   * Abstract thinking method to be implemented by concrete strategies
   * This is where the specific thinking logic goes
   */
  protected abstract generateThought(context: AgentContext): Promise<AgentThought>;

  /**
   * Helper: Create action with rationale
   */
  protected createAction(
    toolName: string,
    parameters: Record<string, unknown>,
    rationale: string,
  ): AgentAction {
    return {
      toolName,
      parameters,
      rationale,
    };
  }

  /**
   * Helper: Extract relevant memories by namespace
   */
  protected getMemoriesByNamespace(
    context: AgentContext,
    namespace: string,
  ): string[] {
    return context.relevantMemories
      .filter((m) => m.namespace === namespace)
      .map((m) => m.content);
  }
}

/**
 * CEO Thinking Strategy
 * 
 * Focuses on high-level strategic planning and delegation.
 * 
 * Characteristics:
 * - Strategic, big-picture thinking
 * - Business-focused decision making
 * - Delegates implementation to other agents
 * - Risk assessment and mitigation
 * - Resource allocation
 */
export class CEOThinkingStrategy extends BaseThinkingStrategy {
  protected async generateThought(context: AgentContext): Promise<AgentThought> {
    const { task, projectContext, relevantMemories } = context;

    // Analyze task from strategic perspective
    const reasoning = this.generateStrategicReasoning(
      task,
      projectContext,
      relevantMemories,
    );

    // Plan high-level actions (usually delegation)
    const plannedActions = this.planStrategicActions(task, context);

    // Assess confidence based on information availability
    const confidence = this.assessConfidence(context);

    return {
      reasoning,
      plannedActions,
      confidence,
      metadata: {
        role: 'CEO',
        focus: 'strategic',
        risks: this.identifyRisks(task),
      },
    };
  }

  private generateStrategicReasoning(
    task: string,
    projectContext: Record<string, unknown>,
    memories: unknown[],
  ): string {
    const parts: string[] = [];

    parts.push(
      `Strategic Analysis: The task "${task}" requires a high-level approach.`,
    );

    if (projectContext.goal) {
      parts.push(
        `This aligns with our strategic goal: ${projectContext.goal}.`,
      );
    }

    parts.push(
      'I will delegate specific implementation to specialized agents while maintaining strategic oversight.',
    );

    if (memories.length > 0) {
      parts.push(
        `Leveraging ${memories.length} relevant strategic insights from past decisions.`,
      );
    }

    return parts.join(' ');
  }

  private planStrategicActions(
    task: string,
    context: AgentContext,
  ): AgentAction[] {
    const actions: AgentAction[] = [];

    // CEO typically delegates to PM for breakdown
    actions.push(
      this.createAction(
        'delegate_task',
        {
          targetAgent: AgentRole.PM,
          task: task,
          priority: 'high',
        },
        'Delegate task breakdown and planning to Project Manager',
      ),
    );

    // Monitor progress
    actions.push(
      this.createAction(
        'create_milestone',
        {
          projectId: context.projectId,
          title: `Strategic Milestone: ${task}`,
          description: task,
        },
        'Create milestone for strategic tracking and oversight',
      ),
    );

    return actions;
  }

  private assessConfidence(context: AgentContext): number {
    let confidence = 0.7; // Base confidence

    // Higher confidence with clear goals
    if (context.projectContext.goal) {
      confidence += 0.15;
    }

    // Higher confidence with relevant memories
    if (context.relevantMemories.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private identifyRisks(task: string): string[] {
    const risks: string[] = [];

    // Simple heuristics for risk identification
    const taskLower = task.toLowerCase();

    if (taskLower.includes('new') || taskLower.includes('launch')) {
      risks.push('Market adoption risk');
    }

    if (taskLower.includes('scale') || taskLower.includes('growth')) {
      risks.push('Scaling infrastructure risk');
    }

    if (
      taskLower.includes('deadline') ||
      taskLower.includes('urgent') ||
      taskLower.includes('asap')
    ) {
      risks.push('Timeline pressure risk');
    }

    return risks.length > 0 ? risks : ['Standard execution risk'];
  }
}

/**
 * PM Thinking Strategy
 * 
 * Focuses on task decomposition, planning, and coordination.
 * 
 * Characteristics:
 * - Breaks down complex tasks into subtasks
 * - Identifies dependencies
 * - Assigns priorities
 * - Coordinates between agents
 * - Manages timelines
 */
export class PMThinkingStrategy extends BaseThinkingStrategy {
  protected async generateThought(context: AgentContext): Promise<AgentThought> {
    const { task } = context;

    // Decompose task into actionable subtasks
    const subtasks = this.decomposeTask(task);

    // Generate reasoning
    const reasoning = this.generatePlanningReasoning(task, subtasks, context);

    // Plan actions for each subtask
    const plannedActions = this.planSubtaskActions(subtasks, context);

    // Calculate confidence
    const confidence = this.calculatePlanningConfidence(context);

    return {
      reasoning,
      plannedActions,
      confidence,
      metadata: {
        role: 'PM',
        focus: 'planning',
        subtasks,
        priority: this.determinePriority(task),
        dependencies: this.identifyDependencies(subtasks),
      },
    };
  }

  private decomposeTask(task: string): string[] {
    // Simple decomposition heuristics
    const subtasks: string[] = [];

    const taskLower = task.toLowerCase();

    // Common task patterns
    if (
      taskLower.includes('build') ||
      taskLower.includes('implement') ||
      taskLower.includes('create')
    ) {
      subtasks.push('Define requirements and specifications');
      subtasks.push('Design architecture and components');
      subtasks.push('Implement core functionality');
      subtasks.push('Write tests and documentation');
      subtasks.push('Review and deploy');
    } else if (taskLower.includes('test') || taskLower.includes('verify')) {
      subtasks.push('Create test plan');
      subtasks.push('Execute test scenarios');
      subtasks.push('Document results');
      subtasks.push('Report issues');
    } else if (
      taskLower.includes('deploy') ||
      taskLower.includes('release')
    ) {
      subtasks.push('Prepare deployment checklist');
      subtasks.push('Execute deployment');
      subtasks.push('Verify deployment');
      subtasks.push('Monitor post-deployment');
    } else {
      // Generic decomposition
      subtasks.push('Analyze task requirements');
      subtasks.push('Plan implementation approach');
      subtasks.push('Execute implementation');
      subtasks.push('Verify completion');
    }

    return subtasks;
  }

  private generatePlanningReasoning(
    task: string,
    subtasks: string[],
    context: AgentContext,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Task Breakdown: "${task}" has been decomposed into ${subtasks.length} actionable subtasks.`,
    );

    parts.push(
      'Each subtask will be assigned to the appropriate specialized agent.',
    );

    if (context.relevantMemories.length > 0) {
      parts.push(
        `Drawing from ${context.relevantMemories.length} relevant planning experiences.`,
      );
    }

    return parts.join(' ');
  }

  private planSubtaskActions(
    subtasks: string[],
    context: AgentContext,
  ): AgentAction[] {
    const actions: AgentAction[] = [];

    // Create task for each subtask (delegate to appropriate agent)
    subtasks.forEach((subtask, index) => {
      const targetAgent = this.determineTargetAgent(subtask);

      actions.push(
        this.createAction(
          'create_task',
          {
            projectId: context.projectId,
            title: subtask,
            description: subtask,
            assignedAgent: targetAgent,
            order: index + 1,
          },
          `Create subtask: ${subtask}`,
        ),
      );
    });

    return actions;
  }

  private determineTargetAgent(subtask: string): AgentRole {
    const lower = subtask.toLowerCase();

    if (
      lower.includes('implement') ||
      lower.includes('code') ||
      lower.includes('develop')
    ) {
      return AgentRole.DEV;
    }

    if (lower.includes('test') || lower.includes('verify') || lower.includes('qa')) {
      return AgentRole.QA;
    }

    if (
      lower.includes('market') ||
      lower.includes('campaign') ||
      lower.includes('content')
    ) {
      return AgentRole.MARKETING;
    }

    // Default to DEV for technical tasks
    return AgentRole.DEV;
  }

  private calculatePlanningConfidence(context: AgentContext): number {
    let confidence = 0.75;

    if (context.projectContext.description) {
      confidence += 0.1;
    }

    if (context.relevantMemories.length > 2) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private determinePriority(task: string): 'low' | 'medium' | 'high' | 'critical' {
    const lower = task.toLowerCase();

    if (lower.includes('critical') || lower.includes('urgent') || lower.includes('asap')) {
      return 'critical';
    }

    if (lower.includes('important') || lower.includes('priority')) {
      return 'high';
    }

    if (lower.includes('nice to have') || lower.includes('optional')) {
      return 'low';
    }

    return 'medium';
  }

  private identifyDependencies(subtasks: string[]): string[] {
    // Simple dependency detection
    const dependencies: string[] = [];

    if (subtasks.length > 1) {
      dependencies.push('Sequential execution required');
    }

    if (subtasks.some((t) => t.toLowerCase().includes('design'))) {
      dependencies.push('Design must be completed before implementation');
    }

    if (subtasks.some((t) => t.toLowerCase().includes('test'))) {
      dependencies.push('Implementation must be completed before testing');
    }

    return dependencies;
  }
}

/**
 * DEV Thinking Strategy
 * 
 * Focuses on technical implementation and code quality.
 * 
 * Characteristics:
 * - Technical implementation planning
 * - Code quality consideration
 * - Best practices application
 * - Memory-driven coding conventions
 * - Tool selection for development
 */
export class DEVThinkingStrategy extends BaseThinkingStrategy {
  protected async generateThought(context: AgentContext): Promise<AgentThought> {
    const { task, availableTools, relevantMemories } = context;

    // Analyze technical requirements
    const reasoning = this.generateTechnicalReasoning(
      task,
      relevantMemories,
    );

    // Plan implementation actions
    const plannedActions = this.planImplementationActions(
      task,
      availableTools,
      context,
    );

    // Assess technical confidence
    const confidence = this.assessTechnicalConfidence(context);

    return {
      reasoning,
      plannedActions,
      confidence,
      metadata: {
        role: 'DEV',
        focus: 'implementation',
        memoriesUsed: relevantMemories.map((m) => m.id),
        codeQualityConsiderations: this.getQualityChecklist(),
      },
    };
  }

  private generateTechnicalReasoning(
    task: string,
    memories: unknown[],
  ): string {
    const parts: string[] = [];

    parts.push(
      `Technical Analysis: Implementing "${task}" requires careful consideration of code quality and maintainability.`,
    );

    const codingConventions = this.getMemoriesByNamespace(
      { relevantMemories: memories } as any,
      'coding_conventions',
    );

    if (codingConventions.length > 0) {
      parts.push(
        `Applying established coding conventions: ${codingConventions[0]}.`,
      );
    }

    parts.push(
      'I will follow best practices including proper error handling, testing, and documentation.',
    );

    return parts.join(' ');
  }

  private planImplementationActions(
    task: string,
    availableTools: any[],
    context: AgentContext,
  ): AgentAction[] {
    const actions: AgentAction[] = [];
    const taskLower = task.toLowerCase();

    // Read existing code if modifying
    if (
      taskLower.includes('refactor') ||
      taskLower.includes('modify') ||
      taskLower.includes('update')
    ) {
      actions.push(
        this.createAction(
          'read_file',
          {
            path: this.inferFilePath(task),
          },
          'Read existing code to understand current implementation',
        ),
      );
    }

    // Write implementation
    actions.push(
      this.createAction(
        'write_file',
        {
          path: this.inferFilePath(task),
          content: 'Implementation will be generated based on requirements',
        },
        `Implement ${task} with clean, maintainable code`,
      ),
    );

    // Run tests if available
    if (availableTools.some((t) => t.name === 'run_tests')) {
      actions.push(
        this.createAction(
          'run_tests',
          {
            testPath: './tests',
          },
          'Verify implementation with automated tests',
        ),
      );
    }

    return actions;
  }

  private inferFilePath(task: string): string {
    // Simple file path inference
    const taskLower = task.toLowerCase();

    if (taskLower.includes('api') || taskLower.includes('endpoint')) {
      return 'src/api/endpoint.ts';
    }

    if (taskLower.includes('service')) {
      return 'src/services/service.ts';
    }

    if (taskLower.includes('component')) {
      return 'src/components/Component.tsx';
    }

    return 'src/index.ts';
  }

  private assessTechnicalConfidence(context: AgentContext): number {
    let confidence = 0.7;

    // Higher confidence with available tools
    if (context.availableTools.length > 3) {
      confidence += 0.1;
    }

    // Higher confidence with relevant coding memories
    const codingMemories = context.relevantMemories.filter(
      (m) => m.namespace === 'coding_conventions',
    );
    if (codingMemories.length > 0) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  private getQualityChecklist(): string[] {
    return [
      'Clean code principles',
      'Proper error handling',
      'Unit test coverage',
      'Documentation',
      'Code review ready',
    ];
  }
}

/**
 * QA Thinking Strategy
 * 
 * Focuses on testing and quality assurance.
 * 
 * Characteristics:
 * - Comprehensive test planning
 * - Edge case identification
 * - Quality verification
 * - Test scenario generation
 * - Bug detection focus
 */
export class QAThinkingStrategy extends BaseThinkingStrategy {
  protected async generateThought(context: AgentContext): Promise<AgentThought> {
    const { task } = context;

    // Generate test scenarios
    const testScenarios = this.generateTestScenarios(task);

    // Create reasoning
    const reasoning = this.generateTestingReasoning(task, testScenarios);

    // Plan testing actions
    const plannedActions = this.planTestingActions(testScenarios, context);

    // Assess testing confidence
    const confidence = 0.85; // QA is thorough

    return {
      reasoning,
      plannedActions,
      confidence,
      metadata: {
        role: 'QA',
        focus: 'quality_assurance',
        testScenarios,
        coverageAreas: this.identifyCoverageAreas(task),
      },
    };
  }

  private generateTestScenarios(task: string): string[] {
    const scenarios: string[] = [];
    const taskLower = task.toLowerCase();

    // Happy path
    scenarios.push('Verify happy path with valid inputs');

    // Edge cases
    scenarios.push('Test edge cases and boundary conditions');
    scenarios.push('Test with invalid inputs');
    scenarios.push('Test error handling');

    // Specific scenarios based on task
    if (taskLower.includes('api') || taskLower.includes('endpoint')) {
      scenarios.push('Test API response codes');
      scenarios.push('Test authentication and authorization');
    }

    if (taskLower.includes('ui') || taskLower.includes('interface')) {
      scenarios.push('Test user interface interactions');
      scenarios.push('Test responsive design');
    }

    if (taskLower.includes('performance')) {
      scenarios.push('Load testing and performance benchmarks');
    }

    return scenarios;
  }

  private generateTestingReasoning(
    task: string,
    scenarios: string[],
  ): string {
    const parts: string[] = [];

    parts.push(
      `Quality Assurance Plan: Testing "${task}" requires comprehensive coverage of ${scenarios.length} scenarios.`,
    );

    parts.push(
      'I will verify both happy path functionality and edge cases to ensure reliability and robustness.',
    );

    parts.push(
      'All test results will be documented for tracking and future reference.',
    );

    return parts.join(' ');
  }

  private planTestingActions(
    scenarios: string[],
    context: AgentContext,
  ): AgentAction[] {
    const actions: AgentAction[] = [];

    // Write test cases
    actions.push(
      this.createAction(
        'write_test',
        {
          testFile: 'tests/feature.spec.ts',
          scenarios,
        },
        'Create comprehensive test suite covering all scenarios',
      ),
    );

    // Run tests
    actions.push(
      this.createAction(
        'run_tests',
        {
          testPath: './tests',
          coverage: true,
        },
        'Execute test suite and generate coverage report',
      ),
    );

    // Document results
    actions.push(
      this.createAction(
        'create_report',
        {
          projectId: context.projectId,
          reportType: 'qa',
          scenarios,
        },
        'Document test results and quality metrics',
      ),
    );

    return actions;
  }

  private identifyCoverageAreas(task: string): string[] {
    const areas: string[] = ['Functional testing', 'Error handling'];

    const taskLower = task.toLowerCase();

    if (taskLower.includes('api')) {
      areas.push('API contract testing');
    }

    if (taskLower.includes('performance')) {
      areas.push('Performance testing');
    }

    if (taskLower.includes('security')) {
      areas.push('Security testing');
    }

    return areas;
  }
}

/**
 * Marketing Thinking Strategy
 * 
 * Focuses on marketing analysis and campaign planning.
 * 
 * Characteristics:
 * - Audience analysis
 * - Campaign planning
 * - Metrics and KPI tracking
 * - Content strategy
 * - Brand awareness
 */
export class MarketingThinkingStrategy extends BaseThinkingStrategy {
  protected async generateThought(context: AgentContext): Promise<AgentThought> {
    const { task, projectContext } = context;

    // Analyze marketing objectives
    const reasoning = this.generateMarketingReasoning(task, projectContext);

    // Plan marketing actions
    const plannedActions = this.planMarketingActions(task, context);

    // Assess marketing confidence
    const confidence = 0.8;

    return {
      reasoning,
      plannedActions,
      confidence,
      metadata: {
        role: 'MARKETING',
        focus: 'marketing_strategy',
        targetAudience: this.identifyTargetAudience(task, projectContext),
        metrics: this.defineMetrics(task),
        channels: this.selectChannels(task),
      },
    };
  }

  private generateMarketingReasoning(
    task: string,
    projectContext: Record<string, unknown>,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Marketing Strategy: "${task}" requires understanding our target audience and market positioning.`,
    );

    if (projectContext.goal) {
      parts.push(
        `This campaign aligns with our business goal: ${projectContext.goal}.`,
      );
    }

    parts.push(
      'I will focus on measurable metrics and KPIs to track campaign effectiveness.',
    );

    parts.push(
      'Content will be tailored to resonate with our target customer segments.',
    );

    return parts.join(' ');
  }

  private planMarketingActions(
    task: string,
    context: AgentContext,
  ): AgentAction[] {
    const actions: AgentAction[] = [];
    const taskLower = task.toLowerCase();

    // Audience analysis
    actions.push(
      this.createAction(
        'analyze_audience',
        {
          projectId: context.projectId,
        },
        'Analyze target audience demographics and preferences',
      ),
    );

    // Content creation
    if (
      taskLower.includes('content') ||
      taskLower.includes('campaign') ||
      taskLower.includes('launch')
    ) {
      actions.push(
        this.createAction(
          'create_content',
          {
            type: 'campaign',
            theme: task,
          },
          'Create compelling marketing content and messaging',
        ),
      );
    }

    // Metrics tracking
    actions.push(
      this.createAction(
        'setup_analytics',
        {
          projectId: context.projectId,
          metrics: this.defineMetrics(task),
        },
        'Set up analytics to track campaign performance and KPIs',
      ),
    );

    return actions;
  }

  private identifyTargetAudience(
    task: string,
    projectContext: Record<string, unknown>,
  ): string {
    // Simple audience identification
    const taskLower = task.toLowerCase();

    if (taskLower.includes('b2b') || taskLower.includes('enterprise')) {
      return 'Enterprise businesses and decision makers';
    }

    if (taskLower.includes('developer') || taskLower.includes('technical')) {
      return 'Software developers and technical professionals';
    }

    return 'General consumer audience';
  }

  private defineMetrics(task: string): string[] {
    const metrics = ['Reach', 'Engagement'];

    const taskLower = task.toLowerCase();

    if (taskLower.includes('conversion')) {
      metrics.push('Conversion rate');
    }

    if (taskLower.includes('awareness') || taskLower.includes('brand')) {
      metrics.push('Brand awareness');
      metrics.push('Social mentions');
    }

    if (taskLower.includes('launch') || taskLower.includes('campaign')) {
      metrics.push('Campaign ROI');
      metrics.push('Customer acquisition cost');
    }

    return metrics;
  }

  private selectChannels(task: string): string[] {
    const channels: string[] = [];
    const taskLower = task.toLowerCase();

    if (
      taskLower.includes('social') ||
      taskLower.includes('awareness') ||
      taskLower.includes('brand')
    ) {
      channels.push('Social Media');
    }

    if (taskLower.includes('email') || taskLower.includes('newsletter')) {
      channels.push('Email Marketing');
    }

    if (taskLower.includes('content') || taskLower.includes('blog')) {
      channels.push('Content Marketing');
    }

    if (channels.length === 0) {
      channels.push('Multi-channel');
    }

    return channels;
  }
}
