import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskCommentResponseDto } from './responses/task-comment-response.dto';
import { TaskCommentListResponseDto } from './responses/task-comment-list-response.dto';
import { TaskCommentCreateDto, TaskCommentUpdateDto } from './dto';

@Injectable()
export class TaskCommentService {
  constructor(private readonly prisma: PrismaService) {}

  async listComments(taskId: string): Promise<TaskCommentListResponseDto> {
    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });
    return {
      comments: comments.map((c) => ({
        id: c.id,
        taskId: c.taskId,
        comment: c.comment,
        createdAt: c.createdAt,
        user: {
          id: c.user.id,
          email: c.user.email,
          firstName: c.user.firstName,
          lastName: c.user.lastName,
        },
      })),
      total: comments.length,
    };
  }

  async getComment(id: string): Promise<TaskCommentResponseDto> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return {
      id: comment.id,
      taskId: comment.taskId,
      comment: comment.comment,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        email: comment.user.email,
        firstName: comment.user.firstName,
        lastName: comment.user.lastName,
      },
    };
  }

  async createComment(
    userId: string,
    taskId: string,
    dto: TaskCommentCreateDto,
  ): Promise<TaskCommentResponseDto> {
    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        comment: dto.comment,
      },
      include: { user: true },
    });
    return {
      id: comment.id,
      taskId: comment.taskId,
      comment: comment.comment,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        email: comment.user.email,
        firstName: comment.user.firstName,
        lastName: comment.user.lastName,
      },
    };
  }

  async updateComment(
    userId: string,
    id: string,
    dto: TaskCommentUpdateDto,
  ): Promise<TaskCommentResponseDto> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId)
      throw new ForbiddenException('Not your comment');
    const updated = await this.prisma.taskComment.update({
      where: { id },
      data: { comment: dto.comment },
      include: { user: true },
    });
    return {
      id: updated.id,
      taskId: updated.taskId,
      comment: updated.comment,
      createdAt: updated.createdAt,
      user: {
        id: updated.user.id,
        email: updated.user.email,
        firstName: updated.user.firstName,
        lastName: updated.user.lastName,
      },
    };
  }

  async deleteComment(
    userId: string,
    id: string,
  ): Promise<{ deleted: boolean }> {
    const comment = await this.prisma.taskComment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId)
      throw new ForbiddenException('Not your comment');
    await this.prisma.taskComment.delete({ where: { id } });
    return { deleted: true };
  }
}
