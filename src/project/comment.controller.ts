import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser } from '../common/decorators';
import { CommentService } from './comment.service';
import {
  ProjectCommentTargetDto,
  CreateProjectCommentDto,
  UpdateProjectCommentDto,
} from './dto';
import { ProjectCommentResponse } from './responses';

/** Comments on a project, task, part or journal entry (D10). */
@ApiTags('Comments')
@ApiBearerAuth()
@Controller('comments')
export class ProjectCommentController {
  constructor(private readonly comments: CommentService) {}

  /** Exactly one target in the query. Oldest first. */
  @Get()
  @ApiOkResponse({ type: ProjectCommentResponse, isArray: true })
  list(
    @GetCurrentUser('sub') userId: string,
    @Query() target: ProjectCommentTargetDto,
  ): Promise<ProjectCommentResponse[]> {
    return this.comments.list(userId, target);
  }

  @Post()
  @ApiOkResponse({ type: ProjectCommentResponse })
  create(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateProjectCommentDto,
  ): Promise<ProjectCommentResponse> {
    return this.comments.create(userId, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProjectCommentResponse })
  update(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectCommentDto,
  ): Promise<ProjectCommentResponse> {
    return this.comments.update(userId, id, dto.body);
  }

  @Delete(':id')
  remove(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.comments.remove(userId, id);
  }
}
