import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser } from '../common/decorators';
import {
  CreateChecklistItemDto,
  MoveTaskDto,
  MyTasksQueryDto,
  ReorderIdsDto,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from './dto';
import {
  ChecklistItemResponse,
  TaskDetailResponse,
  TaskResponse,
} from './responses';
import { TaskService } from './task.service';

/** A single task, wherever it lives. Access comes from its project (I1). */
@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  /** Your open work across every project: assigned to you, or in your inbox. */
  @Get('mine')
  @ApiOkResponse({ type: TaskResponse, isArray: true })
  mine(
    @GetCurrentUser('sub') userId: string,
    @Query() query: MyTasksQueryDto,
  ): Promise<TaskResponse[]> {
    return this.tasks.mine(userId, query.view);
  }

  @Get(':id')
  @ApiOkResponse({ type: TaskDetailResponse })
  get(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<TaskDetailResponse> {
    return this.tasks.get(userId, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: TaskDetailResponse })
  update(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDetailResponse> {
    return this.tasks.update(userId, id, dto);
  }

  /** Drag on the board: into a status column, at a position. */
  @Post(':id/move')
  @ApiOkResponse({ type: TaskDetailResponse })
  move(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: MoveTaskDto,
  ): Promise<TaskDetailResponse> {
    return this.tasks.move(userId, id, dto);
  }

  /** Tick on or off; viewers too when the project lets them. */
  @Post(':id/toggle')
  @ApiOkResponse({ type: TaskDetailResponse })
  toggle(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<TaskDetailResponse> {
    return this.tasks.toggle(userId, id);
  }

  @Delete(':id')
  remove(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.tasks.remove(userId, id);
  }

  // — checklist —

  @Post(':id/checklist')
  @ApiOkResponse({ type: ChecklistItemResponse, isArray: true })
  addChecklistItem(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemResponse[]> {
    return this.tasks.addChecklistItem(userId, id, dto);
  }

  @Put(':id/checklist/order')
  @ApiOkResponse({ type: ChecklistItemResponse, isArray: true })
  reorderChecklist(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReorderIdsDto,
  ): Promise<ChecklistItemResponse[]> {
    return this.tasks.reorderChecklist(userId, id, dto.ids);
  }

  @Patch(':id/checklist/:itemId')
  @ApiOkResponse({ type: ChecklistItemResponse, isArray: true })
  updateChecklistItem(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemResponse[]> {
    return this.tasks.updateChecklistItem(userId, id, itemId, dto);
  }

  @Delete(':id/checklist/:itemId')
  @ApiOkResponse({ type: ChecklistItemResponse, isArray: true })
  removeChecklistItem(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<ChecklistItemResponse[]> {
    return this.tasks.removeChecklistItem(userId, id, itemId);
  }
}
