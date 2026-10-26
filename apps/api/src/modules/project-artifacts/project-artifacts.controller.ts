import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../access/access.decorators';
import { ProjectArtifactsService } from './project-artifacts.service';

/**
 * Generated project artifacts (Phase 3, Task 13): what the agents produced for a project,
 * browsable and downloadable. Everything is read through ProjectWorkspace.
 */
@Controller('projects')
@RequirePermission(Permission.PROJECT_READ)
export class ProjectArtifactsController {
  constructor(private readonly artifacts: ProjectArtifactsService) {}

  @Get(':id/files')
  listFiles(@Param('id') projectId: string) {
    return this.artifacts.listFiles(projectId);
  }

  /** GET /api/projects/:id/files/docs/use-cases.md */
  @Get(':id/files/*')
  readFile(@Param('id') projectId: string, @Param('0') filePath: string) {
    return this.artifacts.readFile(projectId, filePath);
  }

  @Get(':id/archive')
  async archive(@Param('id') projectId: string): Promise<StreamableFile> {
    const { fileName, buffer } = await this.artifacts.archive(projectId);
    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="${fileName}"`,
      length: buffer.length,
    });
  }

  @Get(':id/quality-gates')
  qualityGates(@Param('id') projectId: string, @Query('limit') limit?: string) {
    return this.artifacts.qualityGates(projectId, limit ? parseInt(limit, 10) || 20 : 20);
  }
}
