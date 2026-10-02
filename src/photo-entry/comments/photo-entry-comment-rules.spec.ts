import {
  PhotoEntryCommentKind,
  PhotoEntryPostStage,
  PhotoEntryStatus,
} from '@prisma/client';

import {
  CommentStage,
  isOpenTodo,
  resolvedAtAfterKindChange,
  resolveViolation,
  stageOf,
} from './photo-entry-comment-rules';

describe('stageOf (§8)', () => {
  it('tells planning apart from "shot, nothing done"', () => {
    expect(stageOf(PhotoEntryStatus.PLANNED, PhotoEntryPostStage.NONE)).toBe(
      CommentStage.PLANNING,
    );
    expect(stageOf(PhotoEntryStatus.SHOT, PhotoEntryPostStage.NONE)).toBe(
      CommentStage.AFTER_SHOOT,
    );
  });

  it('follows the post-processing axis once shot', () => {
    expect(stageOf(PhotoEntryStatus.SHOT, PhotoEntryPostStage.SELECTING)).toBe(
      CommentStage.SELECTING,
    );
    expect(stageOf(PhotoEntryStatus.SHOT, PhotoEntryPostStage.EDITING)).toBe(
      CommentStage.EDITING,
    );
    expect(stageOf(PhotoEntryStatus.SHOT, PhotoEntryPostStage.FINISHED)).toBe(
      CommentStage.FINISHED,
    );
  });

  it('keeps notes on a cancelled entry apart', () => {
    expect(stageOf(PhotoEntryStatus.CANCELLED, PhotoEntryPostStage.NONE)).toBe(
      CommentStage.CANCELLED,
    );
  });
});

describe('P9 — resolution belongs to TODO only', () => {
  it('resolves TODOs and nothing else', () => {
    expect(resolveViolation(PhotoEntryCommentKind.TODO)).toBeNull();
    expect(resolveViolation(PhotoEntryCommentKind.HIGHLIGHT)).toMatch(/TODO/);
  });

  it('clears the resolution when a TODO becomes something else', () => {
    expect(resolvedAtAfterKindChange(PhotoEntryCommentKind.NOTE)).toBeNull();
    expect(
      resolvedAtAfterKindChange(PhotoEntryCommentKind.TODO),
    ).toBeUndefined();
    expect(resolvedAtAfterKindChange(undefined)).toBeUndefined();
  });

  it('counts only unresolved TODOs as open', () => {
    expect(
      isOpenTodo({ kind: PhotoEntryCommentKind.TODO, resolvedAt: null }),
    ).toBe(true);
    expect(
      isOpenTodo({ kind: PhotoEntryCommentKind.TODO, resolvedAt: new Date() }),
    ).toBe(false);
    expect(
      isOpenTodo({ kind: PhotoEntryCommentKind.NOTE, resolvedAt: null }),
    ).toBe(false);
  });
});
