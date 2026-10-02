import {
  PhotoEntryCommentKind,
  PhotoEntryPostStage,
  PhotoEntryStatus,
} from '@prisma/client';

import { CommentStage } from './photo-entry-comment-rules';
import {
  loadCommentSummaries,
  PhotoEntryCommentService,
} from './photo-entry-comment.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const comment = (over: Record<string, any> = {}) => ({
  id: 'c1',
  photoEntryId: 'pe1',
  kind: PhotoEntryCommentKind.NOTE,
  body: 'take the ND filter',
  atStatus: PhotoEntryStatus.PLANNED,
  atPostStage: PhotoEntryPostStage.NONE,
  resolvedAt: null,
  authorId: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function makeService() {
  const prisma: any = {
    photoEntry: { findFirst: jest.fn() },
    photoEntryComment: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(({ data }: any) => Promise.resolve(comment(data))),
      update: jest.fn(({ data }: any) => Promise.resolve(comment(data))),
      delete: jest.fn(),
    },
  };
  return { service: new PhotoEntryCommentService(prisma), prisma };
}

describe('PhotoEntryCommentService', () => {
  // P8 — the stage is the whole value of a comment, so it comes from the
  // entry as it is now and nowhere else.
  it('stamps both axes from the entry, not from the request', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValue({
      id: 'pe1',
      status: PhotoEntryStatus.SHOT,
      postStage: PhotoEntryPostStage.EDITING,
    });

    const res = await service.create('u1', 'pe1', {
      kind: PhotoEntryCommentKind.TODO,
      body: '  10 of 200 left  ',
      atStatus: PhotoEntryStatus.PLANNED, // ignored: not part of the DTO
    } as any);

    const data = prisma.photoEntryComment.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      atStatus: PhotoEntryStatus.SHOT,
      atPostStage: PhotoEntryPostStage.EDITING,
      body: '10 of 200 left',
      authorId: 'u1',
    });
    expect(res.stage).toBe(CommentStage.EDITING);
  });

  it('groups comments by stage in chronological order', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValue({
      id: 'pe1',
      status: PhotoEntryStatus.SHOT,
      postStage: PhotoEntryPostStage.NONE,
    });
    prisma.photoEntryComment.findMany.mockResolvedValue([
      comment({ id: 'plan' }),
      comment({ id: 'after', atStatus: PhotoEntryStatus.SHOT }),
      comment({ id: 'plan2' }),
    ]);

    const res = await service.list('u1', 'pe1', {});

    expect(res.currentStage).toBe(CommentStage.AFTER_SHOOT);
    expect(
      res.groups.map((g) => [g.stage, g.comments.map((c) => c.id)]),
    ).toEqual([
      [CommentStage.PLANNING, ['plan', 'plan2']],
      [CommentStage.AFTER_SHOOT, ['after']],
    ]);
  });

  it('filters to open TODOs', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValue({
      id: 'pe1',
      status: PhotoEntryStatus.SHOT,
      postStage: PhotoEntryPostStage.NONE,
    });

    await service.list('u1', 'pe1', { unresolved: true });

    expect(prisma.photoEntryComment.findMany.mock.calls[0][0].where).toEqual({
      photoEntryId: 'pe1',
      kind: PhotoEntryCommentKind.TODO,
      resolvedAt: null,
    });
  });

  it('refuses resolving anything but a TODO (P9)', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntryComment.findFirst.mockResolvedValue(
      comment({ kind: PhotoEntryCommentKind.HIGHLIGHT }),
    );

    await expect(service.resolve('u1', 'c1')).rejects.toThrow(/TODO/);
    expect(prisma.photoEntryComment.update).not.toHaveBeenCalled();
  });

  it('drops the resolution when a TODO changes kind (P9)', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntryComment.findFirst.mockResolvedValue(
      comment({ kind: PhotoEntryCommentKind.TODO, resolvedAt: new Date() }),
    );

    await service.patch('u1', 'c1', { kind: PhotoEntryCommentKind.NOTE });

    expect(
      prisma.photoEntryComment.update.mock.calls[0][0].data.resolvedAt,
    ).toBeNull();
  });

  it('reaches comments only through an entry the caller owns', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntryComment.findFirst.mockResolvedValue(null);

    await expect(service.remove('intruder', 'c1')).rejects.toThrow(/not found/);
    expect(prisma.photoEntryComment.findFirst.mock.calls[0][0].where).toEqual({
      id: 'c1',
      photoEntry: { userId: 'intruder' },
    });
  });
});

describe('loadCommentSummaries', () => {
  it('counts open TODOs, highlights and problems per entry', async () => {
    const prisma: any = {
      photoEntryComment: {
        findMany: jest.fn().mockResolvedValue([
          { photoEntryId: 'a', kind: 'TODO', resolvedAt: null },
          { photoEntryId: 'a', kind: 'TODO', resolvedAt: new Date() },
          { photoEntryId: 'a', kind: 'HIGHLIGHT', resolvedAt: null },
          { photoEntryId: 'b', kind: 'PROBLEM', resolvedAt: null },
        ]),
      },
    };

    const s = await loadCommentSummaries(prisma, ['a', 'b', 'c']);

    expect(s.get('a')).toEqual({
      openTodos: 1,
      highlights: 1,
      problems: 0,
      total: 3,
    });
    expect(s.get('b')?.problems).toBe(1);
    expect(s.has('c')).toBe(false);
  });

  it('skips the query for an empty page', async () => {
    const prisma: any = { photoEntryComment: { findMany: jest.fn() } };
    await loadCommentSummaries(prisma, []);
    expect(prisma.photoEntryComment.findMany).not.toHaveBeenCalled();
  });
});
