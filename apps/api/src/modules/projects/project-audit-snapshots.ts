import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  IMilestoneRepository,
  IProjectRepository,
  ITaskRepository,
  MILESTONE_REPOSITORY,
  PROJECT_REPOSITORY,
  TASK_REPOSITORY,
} from '../../domain/repositories';
import { AuditSnapshotRegistry } from '../audit/audit-snapshot.registry';

/** Lets audited updates/deletes of projects, tasks and milestones record before/after (Task 21) */
@Injectable()
export class ProjectAuditSnapshots implements OnModuleInit {
  constructor(
    private readonly registry: AuditSnapshotRegistry,
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
    @Inject(TASK_REPOSITORY) private readonly tasks: ITaskRepository,
    @Inject(MILESTONE_REPOSITORY) private readonly milestones: IMilestoneRepository
  ) {}

  onModuleInit() {
    this.registry.register('Project', id => this.projects.findById(id));
    this.registry.register('Task', id => this.tasks.findById(id));
    this.registry.register('Milestone', id => this.milestones.findById(id));
  }
}
