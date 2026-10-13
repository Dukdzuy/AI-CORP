import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { MilestonesService } from './milestones.service';
import { MilestonesController } from './milestones.controller';
import { WebSocketModule } from '../websocket/websocket.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';

@Module({
  imports: [WebSocketModule, WorkflowModule, InfrastructureModule],
  controllers: [ProjectsController, TasksController, MilestonesController],
  providers: [ProjectsService, TasksService, MilestonesService],
  exports: [ProjectsService, TasksService, MilestonesService],
})
export class ProjectsModule {}
