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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { GetCurrentUser } from '../common/decorators';
import {
  AddProjectMemberDto,
  CreateProjectDto,
  CreateProjectStatusDto,
  CreateTaskDto,
  ListProjectsQueryDto,
  ListTasksQueryDto,
  ReorderDto,
  UpdateProjectDto,
  UpdateProjectMemberDto,
  UpdateProjectStatusDto,
} from './dto';
import { ProjectService } from './project.service';
import {
  ProjectDetailResponse,
  ProjectMemberResponse,
  ProjectStatusResponse,
  ProjectSummaryResponse,
  TaskDetailResponse,
  TaskResponse,
} from './responses';
import { TaskService } from './task.service';

/**
 * Projects are personal data shared by membership, like places: any signed-in
 * account has its own, and what it can do inside one comes from its role
 * there, not from ACL permissions (docs/projects-design.md §6).
 */
@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly tasks: TaskService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ProjectSummaryResponse, isArray: true })
  list(
    @GetCurrentUser('sub') userId: string,
    @Query() query: ListProjectsQueryDto,
  ): Promise<ProjectSummaryResponse[]> {
    return this.projects.list(userId, query);
  }

  /** Your personal inbox, created on first use. */
  @Get('inbox')
  @ApiOkResponse({ type: ProjectDetailResponse })
  inbox(@GetCurrentUser('sub') userId: string): Promise<ProjectDetailResponse> {
    return this.projects.inbox(userId);
  }

  @Post()
  @ApiOkResponse({ type: ProjectDetailResponse })
  create(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDetailResponse> {
    return this.projects.create(userId, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProjectDetailResponse })
  get(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<ProjectDetailResponse> {
    return this.projects.get(userId, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProjectDetailResponse })
  update(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDetailResponse> {
    return this.projects.update(userId, id, dto);
  }

  @Delete(':id')
  remove(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.projects.remove(userId, id);
  }

  // — workflow —

  @Post(':id/statuses')
  @ApiOkResponse({ type: ProjectStatusResponse, isArray: true })
  createStatus(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateProjectStatusDto,
  ): Promise<ProjectStatusResponse[]> {
    return this.projects.createStatus(userId, id, dto);
  }

  @Put(':id/statuses/order')
  @ApiOkResponse({ type: ProjectStatusResponse, isArray: true })
  reorderStatuses(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReorderDto,
  ): Promise<ProjectStatusResponse[]> {
    return this.projects.reorderStatuses(userId, id, dto.ids);
  }

  @Patch(':id/statuses/:statusId')
  @ApiOkResponse({ type: ProjectStatusResponse, isArray: true })
  updateStatus(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('statusId') statusId: string,
    @Body() dto: UpdateProjectStatusDto,
  ): Promise<ProjectStatusResponse[]> {
    return this.projects.updateStatus(userId, id, statusId, dto);
  }

  /** Its tasks move to `moveToStatusId` first. */
  @Delete(':id/statuses/:statusId')
  @ApiQuery({ name: 'moveToStatusId', required: true, type: String })
  @ApiOkResponse({ type: ProjectStatusResponse, isArray: true })
  removeStatus(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('statusId') statusId: string,
    @Query('moveToStatusId') moveToStatusId: string,
  ): Promise<ProjectStatusResponse[]> {
    return this.projects.removeStatus(userId, id, statusId, moveToStatusId);
  }

  // — members —

  @Get(':id/members')
  @ApiOkResponse({ type: ProjectMemberResponse, isArray: true })
  listMembers(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<ProjectMemberResponse[]> {
    return this.projects.listMembers(userId, id);
  }

  /** By the exact e-mail of an existing account. Owner only. */
  @Post(':id/members')
  @ApiOkResponse({ type: ProjectMemberResponse, isArray: true })
  addMember(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
  ): Promise<ProjectMemberResponse[]> {
    return this.projects.addMember(userId, id, dto);
  }

  @Patch(':id/members/:userId')
  @ApiOkResponse({ type: ProjectMemberResponse, isArray: true })
  updateMember(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('userId') memberId: string,
    @Body() dto: UpdateProjectMemberDto,
  ): Promise<ProjectMemberResponse[]> {
    return this.projects.updateMember(userId, id, memberId, dto.role);
  }

  /** The owner removes anyone; a member removes themselves to leave. */
  @Delete(':id/members/:userId')
  removeMember(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('userId') memberId: string,
  ): Promise<void> {
    return this.projects.removeMember(userId, id, memberId);
  }

  // — tasks of a project —

  @Get(':id/tasks')
  @ApiOkResponse({ type: TaskResponse, isArray: true })
  listTasks(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query() query: ListTasksQueryDto,
  ): Promise<TaskResponse[]> {
    return this.tasks.list(userId, id, query);
  }

  @Post(':id/tasks')
  @ApiOkResponse({ type: TaskDetailResponse })
  createTask(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskDetailResponse> {
    return this.tasks.create(userId, id, dto);
  }
}
