// Task and Project types for AI Corp Platform

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done',
}

export enum ProjectStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface Project {
  id: string;
  name: string;
  description: string;
  goal: string;
  status: ProjectStatus;
  budget?: number;
  costAccrued: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  workflowRuns?: WorkflowRun[];
  tasks?: Task[];
  milestones?: Milestone[];
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  workflowDefId: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentNodeId?: string;
  context: any;
  startedAt: Date;
  completedAt?: Date;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent?: string;
  estimatedCost?: number;
  actualCost: number;
  createdAt: Date;
  updatedAt: Date;
}
