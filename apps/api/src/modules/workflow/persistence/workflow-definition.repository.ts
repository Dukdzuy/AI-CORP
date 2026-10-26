import { WorkflowDefinition } from '@ai-corp/shared-types';

/**
 * Persistence port for immutable workflow definition versions (Task 17).
 * Definitions built from templates exist only at run time, so they are stored to survive restarts:
 * runs pinned to them must still find their definition.
 */
export const WORKFLOW_DEFINITION_REPOSITORY = Symbol('IWorkflowDefinitionRepository');

export interface WorkflowDefinitionVersionRecord {
  definitionId: string;
  version: string;
  name: string;
  definition: WorkflowDefinition;
  templateId: string | null;
  parameters: Record<string, unknown> | null;
  createdAt: Date;
}

export interface SaveDefinitionInput {
  definition: WorkflowDefinition;
  templateId?: string;
  parameters?: Record<string, unknown>;
}

export interface IWorkflowDefinitionRepository {
  /** Insert the version if it isn't stored yet (stored versions are never changed) */
  saveIfAbsent(data: SaveDefinitionInput): Promise<void>;
  findAll(): Promise<WorkflowDefinitionVersionRecord[]>;
}
