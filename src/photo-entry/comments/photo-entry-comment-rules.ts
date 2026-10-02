import {
  PhotoEntryCommentKind,
  PhotoEntryPostStage,
  PhotoEntryStatus,
} from '@prisma/client';

/**
 * Comments pinned to the stage they were written at
 * (docs/photo-entry-redesign.md §8). Pure, so the stage mapping and P9 are
 * tested without a database.
 */

/**
 * The stage a comment belongs to, read from BOTH axes. postStage alone cannot
 * tell "not shot yet" from "shot, nothing done" — a packing note and an
 * after-the-trip note would land in the same group.
 */
export enum CommentStage {
  PLANNING = 'PLANNING',
  AFTER_SHOOT = 'AFTER_SHOOT',
  SELECTING = 'SELECTING',
  EDITING = 'EDITING',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

/** Chronological, so groups read as the entry's history. */
export const STAGE_ORDER: readonly CommentStage[] = [
  CommentStage.PLANNING,
  CommentStage.AFTER_SHOOT,
  CommentStage.SELECTING,
  CommentStage.EDITING,
  CommentStage.FINISHED,
  CommentStage.CANCELLED,
];

const POST_STAGE: Record<PhotoEntryPostStage, CommentStage> = {
  [PhotoEntryPostStage.NONE]: CommentStage.AFTER_SHOOT,
  [PhotoEntryPostStage.SELECTING]: CommentStage.SELECTING,
  [PhotoEntryPostStage.EDITING]: CommentStage.EDITING,
  [PhotoEntryPostStage.FINISHED]: CommentStage.FINISHED,
};

export const stageOf = (
  status: PhotoEntryStatus,
  postStage: PhotoEntryPostStage,
): CommentStage => {
  switch (status) {
    // P1 keeps postStage at NONE while PLANNED, so nothing is lost here.
    case PhotoEntryStatus.PLANNED:
      return CommentStage.PLANNING;
    case PhotoEntryStatus.CANCELLED:
      return CommentStage.CANCELLED;
    case PhotoEntryStatus.SHOT:
      return POST_STAGE[postStage];
  }
};

/** P9 — only a TODO can be resolved; a highlight is never "done". */
export const resolveViolation = (kind: PhotoEntryCommentKind): string | null =>
  kind === PhotoEntryCommentKind.TODO
    ? null
    : `Only TODO comments can be resolved, this one is ${kind}`;

/**
 * P9 on edit — turning a TODO into anything else drops its resolution, so a
 * NOTE can never carry a resolvedAt.
 */
export const resolvedAtAfterKindChange = (
  nextKind: PhotoEntryCommentKind | undefined,
): null | undefined =>
  nextKind !== undefined && nextKind !== PhotoEntryCommentKind.TODO
    ? null
    : undefined;

export const isOpenTodo = (c: {
  kind: PhotoEntryCommentKind;
  resolvedAt: Date | null;
}): boolean => c.kind === PhotoEntryCommentKind.TODO && c.resolvedAt === null;
