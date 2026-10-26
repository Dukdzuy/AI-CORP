import { WorkflowDefinition, AgentRole } from '@ai-corp/shared-types';

/**
 * Default OOAD-driven project workflow:
 * CEO (milestones) → BA (use cases) → Architect (design + skeleton) → OOAD quality gate
 * → PM (one task per use case) → DEV (implementation) → QC (acceptance tests + traceability)
 * → QA (design conformance verdict) → Marketing → human approval → CEO (close-out)
 */
export const DEFAULT_WORKFLOW_DEFINITION: WorkflowDefinition = {
  id: 'default-project-workflow',
  name: 'Default Project Workflow',
  version: '2.0.0',
  startNode: 'start',
  endNode: 'end',
  nodes: [
    {
      id: 'start',
      type: 'agent_task',
      agentRole: 'CEO' as AgentRole,
      taskType: 'planMilestones',
      maxRetries: 3,
      timeout: 180000,
      metadata: {
        promptTemplate: 'Analyze the project goal and create a high-level milestone plan. Define 2-4 major milestones with clear deliverables.',
        description: 'CEO plans project milestones',
      },
    },
    {
      id: 'analyze',
      type: 'agent_task',
      agentRole: 'BA' as AgentRole,
      taskType: 'generateUseCases',
      maxRetries: 3,
      timeout: 180000,
      metadata: {
        promptTemplate: 'Analyze the requirements and produce structured use cases with a use case diagram.',
        description: 'BA writes use cases (OOAD analysis)',
      },
    },
    {
      id: 'design',
      type: 'agent_task',
      agentRole: 'ARCHITECT' as AgentRole,
      taskType: 'designArchitecture',
      maxRetries: 3,
      timeout: 300000,
      metadata: {
        promptTemplate: 'Design the domain model, class and sequence diagrams, choose design patterns and generate the layered code skeleton.',
        description: 'Architect designs the system and generates the code skeleton (OOAD design)',
      },
    },
    {
      id: 'ooad_gate',
      type: 'quality_gate',
      metadata: {
        description: 'OOAD quality gate (QA): use cases, domain model, patterns and diagrams must be complete before implementation',
        criteria: {
          minUseCases: 5,
          minEntities: 3,
          minPatterns: 3,
          requiredArtifacts: ['use-cases.md', 'use-case-diagram.puml', 'domain-model.puml', 'class-diagram.puml', 'architecture-patterns.md'],
        },
      },
    },
    {
      id: 'breakdown',
      type: 'agent_task',
      agentRole: 'PM' as AgentRole,
      taskType: 'breakdownTasks',
      maxRetries: 3,
      timeout: 180000,
      metadata: {
        promptTemplate: 'Turn the approved use cases into one developer task per use case, ordered by priority.',
        description: 'PM plans one task per approved use case',
      },
    },
    {
      id: 'develop',
      type: 'agent_task',
      agentRole: 'DEV' as AgentRole,
      taskType: 'implement',
      maxRetries: 3,
      timeout: 300000,
      metadata: {
        promptTemplate: 'Implement the assigned task. Write code, run tests, and ensure the implementation meets requirements.',
        description: 'Dev implements the feature',
      },
    },
    {
      id: 'test',
      type: 'agent_task',
      agentRole: 'QC' as AgentRole,
      taskType: 'verify',
      maxRetries: 3,
      timeout: 300000,
      metadata: {
        promptTemplate: 'Write acceptance tests for every use case and build the traceability matrix (use case -> classes -> code -> tests).',
        description: 'QC verifies the implementation against the use cases',
      },
    },
    {
      id: 'review',
      type: 'agent_task',
      agentRole: 'QA' as AgentRole,
      taskType: 'review',
      maxRetries: 3,
      timeout: 180000,
      metadata: {
        promptTemplate: 'Review the implementation against the approved OOAD design and the QC report. Approve or send it back with findings.',
        description: 'QA reviews design conformance and approves',
      },
    },
    {
      id: 'qa_condition',
      type: 'condition',
      metadata: {
        variable: 'qa_approved',
        operator: 'equals',
        value: true,
        description: 'Check if QA approved the implementation',
      },
    },
    {
      id: 'market',
      type: 'agent_task',
      agentRole: 'MARKETING' as AgentRole,
      taskType: 'draftAnnouncement',
      maxRetries: 3,
      timeout: 180000,
      metadata: {
        promptTemplate: 'Draft a brief internal announcement about the completed feature. Highlight key benefits and changes.',
        description: 'Marketing drafts feature announcement',
      },
    },
    {
      id: 'approval',
      type: 'human_approval',
      metadata: {
        approvalType: 'project_completion',
        message: 'Project deliverables are ready for final approval. Please review and approve to complete the workflow.',
        description: 'Human approval before project completion',
      },
    },
    {
      id: 'end',
      type: 'agent_task',
      agentRole: 'CEO' as AgentRole,
      taskType: 'complete_project',
      maxRetries: 1,
      timeout: 60000,
      metadata: {
        promptTemplate: 'Finalize the project. Summarize accomplishments, costs, and lessons learned.',
        description: 'CEO completes the project',
      },
    },
  ],
  edges: [
    { from: 'start', to: 'analyze' },
    { from: 'analyze', to: 'design' },
    { from: 'design', to: 'ooad_gate' },
    { from: 'ooad_gate', to: 'breakdown', condition: 'onSuccess' },
    { from: 'ooad_gate', to: 'design', condition: 'onFail' },
    { from: 'breakdown', to: 'develop' },
    { from: 'develop', to: 'test' },
    { from: 'test', to: 'review' },
    { from: 'review', to: 'qa_condition' },
    { from: 'qa_condition', to: 'develop', condition: 'onFail' },
    { from: 'qa_condition', to: 'market', condition: 'onSuccess' },
    { from: 'market', to: 'approval' },
    { from: 'approval', to: 'end', condition: 'onApprove' },
  ],
};
