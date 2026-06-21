import { WorkflowDefinition, AgentRole } from '@ai-corp/shared-types';

export const DEFAULT_WORKFLOW_DEFINITION: WorkflowDefinition = {
  id: 'default-project-workflow',
  name: 'Default Project Workflow',
  version: '1.0.0',
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
      id: 'breakdown',
      type: 'agent_task',
      agentRole: 'PM' as AgentRole,
      taskType: 'breakdownTasks',
      maxRetries: 3,
      timeout: 180000,
      metadata: {
        promptTemplate: 'Break down the milestones into actionable tasks. Estimate effort for each task and assign to appropriate team members.',
        description: 'PM breaks down milestones into tasks',
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
      id: 'review',
      type: 'agent_task',
      agentRole: 'QA' as AgentRole,
      taskType: 'review',
      maxRetries: 3,
      timeout: 180000,
      metadata: {
        promptTemplate: 'Review the implementation. Run tests, check for bugs, verify requirements are met. Provide detailed feedback.',
        description: 'QA reviews the implementation',
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
    { from: 'start', to: 'breakdown' },
    { from: 'breakdown', to: 'develop' },
    { from: 'develop', to: 'review' },
    { from: 'review', to: 'qa_condition' },
    { from: 'qa_condition', to: 'develop', condition: 'onFail' },
    { from: 'qa_condition', to: 'market', condition: 'onSuccess' },
    { from: 'market', to: 'approval' },
    { from: 'approval', to: 'end', condition: 'onApprove' },
  ],
};
