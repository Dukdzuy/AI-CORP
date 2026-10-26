import { Module } from '@nestjs/common';
import { ProjectWorkspace } from './project-workspace.service';

/**
 * Workspace Module
 *
 * Provides ProjectWorkspace, the persistent store for files of the projects the agents generate.
 */
@Module({
  providers: [{ provide: ProjectWorkspace, useFactory: () => new ProjectWorkspace() }],
  exports: [ProjectWorkspace],
})
export class WorkspaceModule {}
