import { Module } from '@nestjs/common';

import { WebsocketModule } from '../websocket/websocket.module';
import { ProjectAccessService } from './project-access.service';
import { ProjectController } from './project.controller';
import { ProjectEventsService } from './project-events.service';
import { ProjectService } from './project.service';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

/** Projects, tasks and sharing (docs/projects-design.md). */
@Module({
  imports: [WebsocketModule],
  controllers: [ProjectController, TaskController],
  providers: [
    ProjectAccessService,
    ProjectEventsService,
    ProjectService,
    TaskService,
  ],
  exports: [ProjectAccessService, ProjectService],
})
export class ProjectModule {}
