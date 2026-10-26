/**
 * Repository Injection Tokens
 * Dependency Inversion Principle: the domain owns the abstraction (interface + token),
 * infrastructure binds a concrete implementation to each token.
 */

export const PROJECT_REPOSITORY = Symbol('IProjectRepository');
export const TASK_REPOSITORY = Symbol('ITaskRepository');
export const MILESTONE_REPOSITORY = Symbol('IMilestoneRepository');
export const AGENT_REPOSITORY = Symbol('IAgentRepository');
export const WORKFLOW_REPOSITORY = Symbol('IWorkflowRepository');
export const APPROVAL_REPOSITORY = Symbol('IApprovalRepository');
