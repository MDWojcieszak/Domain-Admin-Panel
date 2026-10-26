import { Module } from '@nestjs/common';

import { NotificationModule } from '../notification/notification.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { BomService } from './bom.service';
import { BuildController } from './build.controller';
import { CalendarController } from './calendar/calendar.controller';
import { CalendarService } from './calendar/calendar.service';
import { DailyDigestService } from './digest/daily-digest.service';
import { ProjectCommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { JournalService } from './journal.service';
import { ProjectAccessService } from './project-access.service';
import { ProjectCopyService } from './project-copy.service';
import { ProjectController } from './project.controller';
import { ProjectEventsService } from './project-events.service';
import { ProjectShareService } from './project-share.service';
import { ProjectService } from './project.service';
import { SharedController } from './shared.controller';
import { TaskController } from './task.controller';
import { TaskReminderService } from './task-reminder.service';
import { TaskService } from './task.service';

/** Projects, tasks and sharing (docs/projects-design.md). */
@Module({
  imports: [WebsocketModule, NotificationModule],
  controllers: [
    ProjectController,
    TaskController,
    SharedController,
    BuildController,
    ProjectCommentController,
    CalendarController,
  ],
  providers: [
    CalendarService,
    DailyDigestService,
    BomService,
    CommentService,
    JournalService,
    ProjectAccessService,
    ProjectCopyService,
    ProjectEventsService,
    ProjectService,
    ProjectShareService,
    TaskReminderService,
    TaskService,
  ],
  exports: [
    ProjectAccessService,
    ProjectEventsService,
    ProjectService,
    BomService,
  ],
})
export class ProjectModule {}
