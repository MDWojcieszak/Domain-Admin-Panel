import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { GetCurrentUser } from '../common/decorators';
import { TaskCommentService } from './task-comment.service';
import { TaskCommentCreateDto, TaskCommentUpdateDto } from './dto';
import {
  TaskCommentResponseDto,
  TaskCommentListResponseDto,
} from './responses';

@ApiTags('Task Comment')
@ApiBearerAuth()
@Controller('task-comment')
export class TaskCommentController {
  constructor(private readonly taskCommentService: TaskCommentService) {}

  @Get('list')
  @ApiOkResponse({ type: TaskCommentListResponseDto })
  async list(
    @Query('taskId') taskId: string,
  ): Promise<TaskCommentListResponseDto> {
    return this.taskCommentService.listComments(taskId);
  }

  @Get(':id')
  @ApiOkResponse({ type: TaskCommentResponseDto })
  async get(@Param('id') id: string): Promise<TaskCommentResponseDto> {
    return this.taskCommentService.getComment(id);
  }

  @Post()
  @ApiOkResponse({ type: TaskCommentResponseDto })
  async create(
    @GetCurrentUser('sub') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: TaskCommentCreateDto,
  ): Promise<TaskCommentResponseDto> {
    return this.taskCommentService.createComment(userId, taskId, dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: TaskCommentResponseDto })
  async update(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: TaskCommentUpdateDto,
  ): Promise<TaskCommentResponseDto> {
    return this.taskCommentService.updateComment(userId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: Object })
  async delete(@GetCurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.taskCommentService.deleteComment(userId, id);
  }
}
