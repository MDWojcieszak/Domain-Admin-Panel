import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PhotoEntryComment,
  PhotoEntryCommentKind,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePhotoEntryCommentDto,
  GetPhotoEntryCommentsQueryDto,
  PatchPhotoEntryCommentDto,
} from './dto';
import {
  CommentStage,
  isOpenTodo,
  resolvedAtAfterKindChange,
  resolveViolation,
  stageOf,
  STAGE_ORDER,
} from './photo-entry-comment-rules';
import {
  PhotoEntryCommentListResponse,
  PhotoEntryCommentResponse,
  PhotoEntryCommentSummaryResponse,
} from './responses';

/**
 * Notes left for yourself on an entry, pinned to the stage they were written
 * at (docs/photo-entry-redesign.md §8).
 */
@Injectable()
export class PhotoEntryCommentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    entryId: string,
    query: GetPhotoEntryCommentsQueryDto,
  ): Promise<PhotoEntryCommentListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);

    const where: Prisma.PhotoEntryCommentWhereInput = {
      photoEntryId: entry.id,
      ...(query.unresolved
        ? { kind: PhotoEntryCommentKind.TODO, resolvedAt: null }
        : query.kind
          ? { kind: query.kind }
          : {}),
    };
    const comments = await this.prisma.photoEntryComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const byStage = new Map<CommentStage, PhotoEntryCommentResponse[]>();
    for (const comment of comments.map(toResponse)) {
      const bucket = byStage.get(comment.stage) ?? [];
      bucket.push(comment);
      byStage.set(comment.stage, bucket);
    }

    return {
      photoEntryId: entry.id,
      currentStage: stageOf(entry.status, entry.postStage),
      groups: STAGE_ORDER.filter((stage) => byStage.has(stage)).map(
        (stage) => ({ stage, comments: byStage.get(stage)! }),
      ),
    };
  }

  /** P8 — the stage comes from the entry as it is now, never from the client. */
  async create(
    userId: string,
    entryId: string,
    dto: CreatePhotoEntryCommentDto,
  ): Promise<PhotoEntryCommentResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);
    const comment = await this.prisma.photoEntryComment.create({
      data: {
        photoEntryId: entry.id,
        authorId: userId,
        kind: dto.kind ?? PhotoEntryCommentKind.NOTE,
        body: requireBody(dto.body),
        atStatus: entry.status,
        atPostStage: entry.postStage,
      },
    });
    return toResponse(comment);
  }

  /** Body and kind only; the stamped stage is never touched (P8). */
  async patch(
    userId: string,
    commentId: string,
    dto: PatchPhotoEntryCommentDto,
  ): Promise<PhotoEntryCommentResponse> {
    await this.getCommentOrThrow(userId, commentId);
    const comment = await this.prisma.photoEntryComment.update({
      where: { id: commentId },
      data: {
        kind: dto.kind,
        body: dto.body === undefined ? undefined : requireBody(dto.body),
        resolvedAt: resolvedAtAfterKindChange(dto.kind),
      },
    });
    return toResponse(comment);
  }

  /** Ticks a TODO off; resolving twice keeps the first time (P9). */
  async resolve(
    userId: string,
    commentId: string,
  ): Promise<PhotoEntryCommentResponse> {
    const existing = await this.getCommentOrThrow(userId, commentId);
    const violation = resolveViolation(existing.kind);
    if (violation) throw new BadRequestException(violation);
    if (existing.resolvedAt) return toResponse(existing);

    const comment = await this.prisma.photoEntryComment.update({
      where: { id: commentId },
      data: { resolvedAt: new Date() },
    });
    return toResponse(comment);
  }

  /** Undoes a resolve — a mis-click must not need a new comment. */
  async reopen(
    userId: string,
    commentId: string,
  ): Promise<PhotoEntryCommentResponse> {
    await this.getCommentOrThrow(userId, commentId);
    const comment = await this.prisma.photoEntryComment.update({
      where: { id: commentId },
      data: { resolvedAt: null },
    });
    return toResponse(comment);
  }

  async remove(userId: string, commentId: string): Promise<{ id: string }> {
    await this.getCommentOrThrow(userId, commentId);
    await this.prisma.photoEntryComment.delete({ where: { id: commentId } });
    return { id: commentId };
  }

  private async getEntryOrThrow(userId: string, entryId: string) {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true, status: true, postStage: true },
    });
    if (!entry) throw new NotFoundException('PhotoEntry not found');
    return entry;
  }

  /** Comments are reachable only through an entry the caller owns. */
  private async getCommentOrThrow(userId: string, commentId: string) {
    const comment = await this.prisma.photoEntryComment.findFirst({
      where: { id: commentId, photoEntry: { userId } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}

const requireBody = (body: string): string => {
  const trimmed = body.trim();
  if (!trimmed) throw new BadRequestException('Comment body is empty');
  return trimmed;
};

const toResponse = (c: PhotoEntryComment): PhotoEntryCommentResponse => ({
  id: c.id,
  photoEntryId: c.photoEntryId,
  kind: c.kind,
  body: c.body,
  atStatus: c.atStatus,
  atPostStage: c.atPostStage,
  stage: stageOf(c.atStatus, c.atPostStage),
  resolvedAt: c.resolvedAt,
  authorId: c.authorId,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

export const emptySummary = (): PhotoEntryCommentSummaryResponse => ({
  openTodos: 0,
  highlights: 0,
  problems: 0,
  total: 0,
});

/**
 * Comment counts for a page of entries in one query, so list views can show
 * "2 open TODOs" or a highlight marker without loading every comment.
 */
export const loadCommentSummaries = async (
  prisma: Pick<PrismaService, 'photoEntryComment'>,
  entryIds: string[],
): Promise<Map<string, PhotoEntryCommentSummaryResponse>> => {
  const summaries = new Map<string, PhotoEntryCommentSummaryResponse>();
  if (entryIds.length === 0) return summaries;

  const comments = await prisma.photoEntryComment.findMany({
    where: { photoEntryId: { in: entryIds } },
    select: { photoEntryId: true, kind: true, resolvedAt: true },
  });

  for (const c of comments) {
    const s = summaries.get(c.photoEntryId) ?? emptySummary();
    s.total++;
    if (isOpenTodo(c)) s.openTodos++;
    if (c.kind === PhotoEntryCommentKind.HIGHLIGHT) s.highlights++;
    if (c.kind === PhotoEntryCommentKind.PROBLEM) s.problems++;
    summaries.set(c.photoEntryId, s);
  }
  return summaries;
};
