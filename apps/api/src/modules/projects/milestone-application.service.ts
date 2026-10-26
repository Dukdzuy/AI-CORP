/**
 * MilestoneApplicationService - Application Service Layer for Milestones
 *
 * Orchestrates Milestone entity operations: load from repository,
 * apply entity business rules, persist the resulting state.
 *
 * @pattern Application Service (DDD)
 * @principle Single Responsibility - entities do business logic, service orchestrates
 */

import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { IMilestoneRepository, MILESTONE_REPOSITORY, MilestoneDTO } from '../../domain/repositories';
import { Milestone } from '../../domain/entities/Milestone';
import { CreateMilestoneDto, UpdateMilestoneDto } from './projects.dto';
import { applyDomainRule } from './domain-rule';

@Injectable()
export class MilestoneApplicationService {
  private readonly logger = new Logger(MilestoneApplicationService.name);

  constructor(
    @Inject(MILESTONE_REPOSITORY) private readonly milestoneRepository: IMilestoneRepository,
  ) {}

  /**
   * Create a milestone through the Milestone entity factory (starts pending)
   */
  async createMilestone(projectId: string, data: CreateMilestoneDto): Promise<MilestoneDTO> {
    const milestone = applyDomainRule(() =>
      Milestone.create({
        projectId,
        name: data.name,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      })
    );

    const state = milestone.toPrimitives();
    const dto = await this.milestoneRepository.create({
      id: state.id,
      projectId: state.projectId,
      name: state.name,
      description: state.description,
      status: state.status,
      dueDate: state.dueDate,
    });

    this.logger.log(`Created milestone ${dto.id} for project ${projectId}`);
    return dto;
  }

  async getMilestones(projectId: string): Promise<MilestoneDTO[]> {
    return this.milestoneRepository.findByProjectId(projectId);
  }

  async updateMilestone(id: string, data: UpdateMilestoneDto): Promise<MilestoneDTO> {
    const existing = await this.milestoneRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Milestone with ID ${id} not found.`);
    }
    const milestone = Milestone.fromPrimitives(existing);

    applyDomainRule(() => {
      milestone.updateDetails(data.name, data.description);
      if (data.dueDate !== undefined) {
        milestone.updateDueDate(data.dueDate !== null ? new Date(data.dueDate) : null);
      }
      if (data.status !== undefined) {
        milestone.transitionTo(data.status);
      }
    });

    const state = milestone.toPrimitives();
    const dto = await this.milestoneRepository.update(id, {
      name: state.name,
      description: state.description,
      status: state.status,
      dueDate: state.dueDate,
    });

    this.logger.log(`Updated milestone ${id}`);
    return dto;
  }
}
