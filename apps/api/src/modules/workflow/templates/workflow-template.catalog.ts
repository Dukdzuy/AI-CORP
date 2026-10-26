import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowTemplateSummary } from '@ai-corp/shared-types';
import { WorkflowTemplate } from '../../../domain/workflow/WorkflowTemplate';
import { OoadSoftwareProjectTemplate } from './ooad-software-project.template';
import { RestApiBackendTemplate } from './rest-api-backend.template';
import { OoadDesignOnlyTemplate } from './ooad-design-only.template';

/** Multi-provider token: every WorkflowTemplate the platform offers (add one here, nothing else changes) */
export const WORKFLOW_TEMPLATES = Symbol('WORKFLOW_TEMPLATES');

export const BUILT_IN_TEMPLATES = (): WorkflowTemplate[] => [
  new OoadSoftwareProjectTemplate(),
  new RestApiBackendTemplate(),
  new OoadDesignOnlyTemplate(),
];

/** The template library (Task 19) */
@Injectable()
export class WorkflowTemplateCatalog {
  private readonly templates: Map<string, WorkflowTemplate>;

  constructor(@Inject(WORKFLOW_TEMPLATES) templates: WorkflowTemplate[]) {
    this.templates = new Map(templates.map(t => [t.id, t]));
  }

  list(): WorkflowTemplateSummary[] {
    return [...this.templates.values()].map(t => t.summary());
  }

  get(templateId: string): WorkflowTemplate {
    const template = this.templates.get(templateId);
    if (!template) throw new NotFoundException(`Workflow template '${templateId}' not found`);
    return template;
  }
}
