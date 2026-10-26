import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MilestoneApplicationService } from './milestone-application.service';
import { MilestoneDTO } from '../../domain/repositories';

function milestoneDto(overrides: Partial<MilestoneDTO> = {}): MilestoneDTO {
  return {
    id: 'milestone-1',
    projectId: 'project-1',
    name: 'MVP',
    description: '',
    status: 'pending',
    dueDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MilestoneApplicationService', () => {
  let repository: any;
  let service: MilestoneApplicationService;

  beforeEach(() => {
    repository = {
      findByProjectId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      create: jest.fn(async (data: any) => milestoneDto(data)),
      update: jest.fn(async (id: string, data: any) => milestoneDto({ id, ...data })),
    };
    service = new MilestoneApplicationService(repository);
  });

  describe('createMilestone', () => {
    it('creates a pending milestone through the entity factory', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await service.createMilestone('project-1', { name: ' MVP ', description: 'first release', dueDate });

      const persisted = repository.create.mock.calls[0][0];
      expect(persisted.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(persisted).toEqual(expect.objectContaining({ name: 'MVP', status: 'pending' }));
      expect(persisted.dueDate).toBeInstanceOf(Date);
    });

    it('rejects a due date in the past', async () => {
      await expect(
        service.createMilestone('project-1', { name: 'MVP', description: '', dueDate: '2000-01-01' })
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateMilestone', () => {
    it('starts a pending milestone', async () => {
      repository.findById.mockResolvedValue(milestoneDto());
      await service.updateMilestone('milestone-1', { status: 'in_progress' });
      expect(repository.update).toHaveBeenCalledWith('milestone-1', expect.objectContaining({ status: 'in_progress' }));
    });

    it('refuses to reopen a completed milestone', async () => {
      repository.findById.mockResolvedValue(milestoneDto({ status: 'completed' }));
      await expect(service.updateMilestone('milestone-1', { status: 'pending' })).rejects.toThrow(BadRequestException);
    });

    it('refuses an unknown status', async () => {
      repository.findById.mockResolvedValue(milestoneDto());
      await expect(service.updateMilestone('milestone-1', { status: 'archived' })).rejects.toThrow(BadRequestException);
    });

    it('returns 404 for an unknown milestone', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.updateMilestone('missing', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });
});
