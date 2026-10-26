import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
    private readonly runs: WorkflowRunQueryService
  ) {}

  @Get('templates')
  listTemplates() {
    return this.definitions.listTemplates();
  }

  @Post('templates/:templateId/preview')
  @HttpCode(200)
  previewTemplate(@Param('templateId') templateId: string, @Body() dto: PreviewTemplateDto) {
    return this.definitions.previewTemplate(templateId, dto.parameters || {});
  }

  @Get('definitions')
  listDefinitions() {
    return this.definitions.listDefinitions();
  }

  @Get('definitions/:definitionId')
  getDefinition(@Param('definitionId') definitionId: string, @Query('version') version?: string) {
    const def = this.definitions.getWorkflowDefinition(definitionId, version);
    if (!def) throw new NotFoundException(`Workflow definition ${definitionId}${version ? `@${version}` : ''} not found`);
    return def;
  }

  @Get('runs/:runId')
  getRun(@Param('runId') runId: string) {
    return this.runs.getRunTree(runId);
  }

  @Get('runs/:runId/snapshots')
  listSnapshots(@Param('runId') runId: string) {
    return this.engine.listSnapshots(runId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('runs/:runId/rollback')
  @HttpCode(200)
  async rollback(@Param('runId') runId: string, @Body() dto: RollbackDto) {
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

  @UseGuards(JwtAuthGuard)
  @Post('runs/:runId/pause')
  @HttpCode(200)
  async pause(@Param('runId') runId: string) {
    await this.engineCall(() => this.engine.pauseWorkflow(runId));
    return { runId, status: 'paused' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('runs/:runId/resume')
  @HttpCode(200)
  async resume(@Param('runId') runId: string) {
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
