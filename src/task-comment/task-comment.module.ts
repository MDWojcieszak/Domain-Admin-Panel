import { Module } from '@nestjs/common';
import { TaskCommentController } from './task-comment.controller';
import { TaskCommentService } from './task-comment.service';

@Module({
  controllers: [TaskCommentController],
  providers: [TaskCommentService],
})
export class TaskCommentModule {}
