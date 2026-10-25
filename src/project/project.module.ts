import { Module } from '@nestjs/common';

import { WebsocketModule } from '../websocket/websocket.module';
import { ProjectAccessService } from './project-access.service';
import { ProjectController } from './project.controller';
import { ProjectEventsService } from './project-events.service';
import { ProjectShareService } from './project-share.service';
import { ProjectService } from './project.service';
import { SharedController } from './shared.controller';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

/** Projects, tasks and sharing (docs/projects-design.md). */
@Module({
  imports: [WebsocketModule],
  controllers: [ProjectController, TaskController, SharedController],
  providers: [
    ProjectAccessService,
    ProjectEventsService,
    ProjectService,
    ProjectShareService,
    TaskService,
  ],
  exports: [ProjectAccessService, ProjectService],
})
export class ProjectModule {}
