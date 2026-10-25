import { Module } from '@nestjs/common';

import { WebsocketModule } from '../websocket/websocket.module';
import { BomService } from './bom.service';
import { BuildController } from './build.controller';
import { ProjectCommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { JournalService } from './journal.service';
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
  controllers: [
    ProjectController,
    TaskController,
    SharedController,
    BuildController,
    ProjectCommentController,
  ],
  providers: [
    BomService,
    CommentService,
    JournalService,
    ProjectAccessService,
    ProjectEventsService,
    ProjectService,
    ProjectShareService,
    TaskService,
  ],
  exports: [ProjectAccessService, ProjectEventsService, ProjectService],
})
export class ProjectModule {}
