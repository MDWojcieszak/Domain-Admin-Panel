import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { singleTarget } from './build-rules';
import { ProjectCommentTargetDto, CreateProjectCommentDto } from './dto';
import { ProjectAccess, ProjectAccessService } from './project-access.service';
import { ProjectEventsService } from './project-events.service';
import { USER_SELECT } from './project.service';
import { ProjectCommentResponse } from './responses';

const TARGETS = ['projectId', 'taskId', 'bomItemId', 'journalEntryId'] as const;
type TargetKey = (typeof TARGETS)[number];

const COMMENT_INCLUDE = {
  author: { select: USER_SELECT },
} satisfies Prisma.CommentInclude;

type CommentRow = Prisma.CommentGetPayload<{ include: typeof COMMENT_INCLUDE }>;

/**
 * Comments on anything in a project (D10): the project, a task, a part or a
 * journal entry, exactly one of them. Whoever sees the project may comment,
 * viewers included (D2). The author edits; the author or the project's owner
 * deletes.
 */
@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: ProjectEventsService,
  ) {}

  async list(
    userId: string,
    target: ProjectCommentTargetDto,
  ): Promise<ProjectCommentResponse[]> {
    const { key, id, role } = await this.resolve(userId, target);
    const comments = await this.prisma.comment.findMany({
      where: { [key]: id },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((c) => toComment(c, userId, role));
  }

  async create(
    userId: string,
    dto: CreateProjectCommentDto,
  ): Promise<ProjectCommentResponse> {
    const { key, id, role, projectId } = await this.resolve(userId, dto);
    const comment = await this.prisma.comment.create({
      data: { [key]: id, body: dto.body.trim(), authorId: userId },
      include: COMMENT_INCLUDE,
    });
    this.notify(userId, projectId, key === 'taskId' ? id : undefined);
    return toComment(comment, userId, role);
  }

  async update(
    userId: string,
    commentId: string,
    body: string,
  ): Promise<ProjectCommentResponse> {
    const { comment, role, projectId } = await this.find(userId, commentId);
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only its author edits a comment.');
    }
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { body: body.trim(), editedAt: new Date() },
      include: COMMENT_INCLUDE,
    });
    this.notify(userId, projectId, comment.taskId ?? undefined);
    return toComment(updated, userId, role);
  }

  async remove(userId: string, commentId: string): Promise<void> {
    const { comment, role, projectId } = await this.find(userId, commentId);
    if (comment.authorId !== userId && role !== ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Only its author or the project owner deletes a comment.',
      );
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    this.notify(userId, projectId, comment.taskId ?? undefined);
  }

  /** The project behind a target, after checking you may see it (I1). */
  private async resolve(userId: string, target: ProjectCommentTargetDto) {
    const chosen = singleTarget<TargetKey>(target, TARGETS);
    if (!chosen) {
      throw new BadRequestException(
        'Comment on exactly one thing: a project, task, part or journal entry.',
      );
    }
    const { key, id } = chosen;
    const grant =
      key === 'projectId'
        ? await this.access.assert(userId, id, ProjectAccess.VIEW)
        : key === 'taskId'
          ? await this.access.assertTask(userId, id, ProjectAccess.VIEW)
          : key === 'bomItemId'
            ? await this.access.assertBomItem(userId, id, ProjectAccess.VIEW)
            : await this.access.assertJournalEntry(
                userId,
                id,
                ProjectAccess.VIEW,
              );
    return { key, id, role: grant.role, projectId: grant.project.id };
  }

  private async find(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    const target = Object.fromEntries(TARGETS.map((k) => [k, comment[k]]));
    try {
      const { role, projectId } = await this.resolve(userId, target);
      return { comment, role, projectId };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('Comment not found');
      }
      throw error;
    }
  }

  private notify(actorId: string, projectId: string, taskId?: string) {
    void this.events.changed({ projectId, kind: 'comment', taskId, actorId });
  }
}

const toComment = (
  comment: CommentRow,
  userId: string,
  role: ProjectRole,
): ProjectCommentResponse => ({
  id: comment.id,
  body: comment.body,
  author: comment.author,
  canEdit: comment.authorId === userId,
  canDelete: comment.authorId === userId || role === ProjectRole.OWNER,
  editedAt: comment.editedAt,
  createdAt: comment.createdAt,
});
