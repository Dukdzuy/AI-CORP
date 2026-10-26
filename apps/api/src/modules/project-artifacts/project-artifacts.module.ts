import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ProjectArtifactsController } from './project-artifacts.controller';
import { ProjectArtifactsService } from './project-artifacts.service';

/**
 * Project Artifacts Module
 *
 * Exposes the files of generated projects (docs, diagrams, code, tests) to the UI.
 */
@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [ProjectArtifactsController],
  providers: [ProjectArtifactsService],
  exports: [ProjectArtifactsService],
})
export class ProjectArtifactsModule {}
