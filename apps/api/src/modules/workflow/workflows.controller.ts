import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { CurrentPrincipal, RequirePermission } from '../access/access.decorators';
import { AuthorizationService } from '../access/authorization.service';
import { Audited } from '../audit/audit.decorators';
import { WorkflowEngine } from './workflow.engine';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WorkflowRunQueryService } from './workflow-run-query.service';

export class PreviewTemplateDto {
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class RollbackDto {
  @IsOptional()
  @IsString()
  snapshotId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  steps?: number;
}

/**
 * Workflow engine API (Phase 4): templates, versioned definitions, run hierarchy, snapshots and rollback.
 */
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly engine: WorkflowEngine,
    private readonly definitions: WorkflowDefinitionService,
    private readonly runs: WorkflowRunQueryService,
    private readonly authorization: AuthorizationService
  ) {}

  @Get('templates')
  @RequirePermission(Permission.PROJECT_READ)
  listTemplates() {
    return this.definitions.listTemplates();
  }

  @Post('templates/:templateId/preview')
  @RequirePermission(Permission.PROJECT_CREATE)
  @HttpCode(200)
  previewTemplate(@Param('templateId') templateId: string, @Body() dto: PreviewTemplateDto) {
    return this.definitions.previewTemplate(templateId, dto.parameters || {});
  }

  @Get('definitions')
  @RequirePermission(Permission.PROJECT_READ)
  listDefinitions() {
    return this.definitions.listDefinitions();
  }

  @Get('definitions/:definitionId')
  @RequirePermission(Permission.PROJECT_READ)
  getDefinition(@Param('definitionId') definitionId: string, @Query('version') version?: string) {
    const def = this.definitions.getWorkflowDefinition(definitionId, version);
    if (!def) throw new NotFoundException(`Workflow definition ${definitionId}${version ? `@${version}` : ''} not found`);
    return def;
  }

  @Get('runs/:runId')
  @RequirePermission(Permission.PROJECT_READ)
  getRun(@Param('runId') runId: string) {
    return this.runs.getRunTree(runId);
  }

  @Get('runs/:runId/snapshots')
  @RequirePermission(Permission.PROJECT_READ)
  listSnapshots(@Param('runId') runId: string) {
    return this.engine.listSnapshots(runId);
  }

  @Post('runs/:runId/rollback')
  @HttpCode(200)
  @RequirePermission(Permission.WORKFLOW_CONTROL)
  @Audited({ action: 'workflow.rollback', resourceType: 'WorkflowRun', idParam: 'runId' })
  async rollback(@Param('runId') runId: string, @Body() dto: RollbackDto, @CurrentPrincipal() principal: Principal, @Req() req: any) {
    await this.authorization.assertRunOwner(principal, runId, 'roll back', req);
    const target = dto.snapshotId ? { snapshotId: dto.snapshotId } : { steps: dto.steps ?? 1 };
    const { run, snapshot, cancelledApprovals } = await this.engineCall(() => this.engine.rollbackWorkflow(runId, target));
    return {
      message: `Rolled back to snapshot #${snapshot.sequence}; the run is paused at node ${snapshot.nodeId}`,
      runId: run.id,
      status: run.status,
      currentNodeId: run.currentNodeId,
      snapshot: { sequence: snapshot.sequence, nodeId: snapshot.nodeId, createdAt: snapshot.createdAt },
      cancelledApprovals,
    };
  }

  @Post('runs/:runId/pause')
  @HttpCode(200)
  @RequirePermission(Permission.WORKFLOW_CONTROL)
  @Audited({ action: 'workflow.pause', resourceType: 'WorkflowRun', idParam: 'runId' })
  async pause(@Param('runId') runId: string, @CurrentPrincipal() principal: Principal, @Req() req: any) {
    await this.authorization.assertRunOwner(principal, runId, 'pause', req);
    await this.engineCall(() => this.engine.pauseWorkflow(runId));
    return { runId, status: 'paused' };
  }

  @Post('runs/:runId/resume')
  @HttpCode(200)
  @RequirePermission(Permission.WORKFLOW_CONTROL)
  @Audited({ action: 'workflow.resume', resourceType: 'WorkflowRun', idParam: 'runId' })
  async resume(@Param('runId') runId: string, @CurrentPrincipal() principal: Principal, @Req() req: any) {
    await this.authorization.assertRunOwner(principal, runId, 'resume', req);
    await this.engineCall(() => this.engine.resumeWorkflow(runId));
    return { runId, status: 'running' };
  }

  /** The engine reports bad requests as plain errors; map them to HTTP status codes */
  private async engineCall<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      const message = (error as Error).message;
      if (/not found/i.test(message)) throw new NotFoundException(message);
      throw new BadRequestException(message);
    }
  }
}
