import { Module } from '@nestjs/common';
import { ProjectApplicationService } from './project-application.service';
import { ProjectsController } from './projects.controller';
import { TaskApplicationService } from './task-application.service';
import { TasksController } from './tasks.controller';
import { MilestoneApplicationService } from './milestone-application.service';
import { MilestonesController } from './milestones.controller';
import { WebSocketModule } from '../websocket/websocket.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ProjectAuditSnapshots } from './project-audit-snapshots';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [WebSocketModule, WorkflowModule, InfrastructureModule, WorkspaceModule],
  controllers: [ProjectsController, TasksController, MilestonesController],
  providers: [ProjectApplicationService, TaskApplicationService, MilestoneApplicationService, ProjectAuditSnapshots],
  exports: [ProjectApplicationService, TaskApplicationService, MilestoneApplicationService],
})
export class ProjectsModule {}
