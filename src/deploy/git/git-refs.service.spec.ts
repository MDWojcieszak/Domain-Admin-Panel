import { BadGatewayException, BadRequestException } from '@nestjs/common';

import { GitRefsService } from './git-refs.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const APP = {
  slug: 'gallery-v2',
  gitRef: null as string | null,
  gitRepo: {
    repo: 'MDWojcieszak/photo-gallery',
    branch: 'main',
    accountId: 'acc-1' as string | null,
    account: { provider: 'github.com' },
  },
};

const commit = (sha: string, message: string) => ({
  sha,
  commit: {
    message,
    author: { name: 'Mateusz', date: '2026-10-01T10:00:00Z' },
    committer: { date: '2026-10-01T10:05:00Z' },
  },
});

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe('GitRefsService', () => {
  let fetchMock: jest.SpyInstance;
  let accounts: any;

  const make = (app: any = APP) => {
    const prisma: any = {
      application: { findFirst: jest.fn().mockResolvedValue(app) },
    };
    accounts = {
      credentials: jest.fn().mockResolvedValue({ token: 'ghp_secret' }),
    };
    return new GitRefsService(prisma, accounts);
  };

  const github = (routes: Record<string, Response>) =>
    fetchMock.mockImplementation(async (url: string) => {
      const match = Object.keys(routes).find((path) => url.includes(path));
      return match ? routes[match] : json({}, 404);
    });

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch' as any);
  });
  afterEach(() => fetchMock.mockRestore());

  it('lists the head, recent commits, tags and branches of the tracked branch', async () => {
    github({
      '/commits?sha=main': json([
        commit('a1b2c3d4e5', 'feat: tiles\n\nlong body'),
        commit('ffeeddccbb', 'fix: thumbs'),
      ]),
      '/tags': json([{ name: 'v2.0.0', commit: { sha: 'a1b2c3d4e5' } }]),
      '/branches': json([{ name: 'main', commit: { sha: 'a1b2c3d4e5' } }]),
    });

    const refs = await make().list('app-1');

    expect(refs.branch).toBe('main');
    expect(refs.head).toEqual({
      sha: 'a1b2c3d4e5',
      shortSha: 'a1b2c3d',
      message: 'feat: tiles',
      author: 'Mateusz',
      committedAt: '2026-10-01T10:05:00Z',
    });
    expect(refs.commits).toHaveLength(2);
    expect(refs.tags).toEqual([
      { name: 'v2.0.0', sha: 'a1b2c3d4e5', shortSha: 'a1b2c3d' },
    ]);
    expect(refs.branches).toEqual([{ name: 'main', sha: 'a1b2c3d4e5' }]);

    // the token goes to GitHub and nowhere else
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer ghp_secret',
    );
    expect(JSON.stringify(refs)).not.toContain('ghp_secret');
  });

  it('follows the branch or tag the application tracks', async () => {
    github({
      '/commits?sha=v1': json([commit('1111111aaa', 'v1 line')]),
      '/tags': json([]),
      '/branches': json([]),
    });

    const refs = await make({ ...APP, gitRef: 'v1' }).list('app-1');

    expect(refs.branch).toBe('v1');
    expect(refs.head?.message).toBe('v1 line');
  });

  it('filters by name, sha prefix or message, and serves repeats from cache', async () => {
    github({
      '/commits': json([
        commit('abc1234', 'gallery tiles'),
        commit('def5678', 'gear'),
      ]),
      '/tags': json([
        { name: 'v1.1.0', commit: { sha: 'abc1234' } },
        { name: 'v2.0.0', commit: { sha: 'def5678' } },
      ]),
      '/branches': json([]),
    });
    const service = make();

    const bySha = await service.list('app-1', 'def');
    const byText = await service.list('app-1', 'TILES');

    expect(bySha.commits.map((c) => c.sha)).toEqual(['def5678']);
    expect(bySha.tags.map((t) => t.name)).toEqual(['v2.0.0']);
    expect(byText.commits.map((c) => c.message)).toEqual(['gallery tiles']);
    // three API calls for the first list, none for the second
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('says what to do for a private repository without a token', async () => {
    github({});

    await expect(
      make({
        ...APP,
        gitRepo: { ...APP.gitRepo, accountId: null, account: null },
      }).list('app-1'),
    ).rejects.toThrow(/private, attach a git account with a token/);
  });

  it('turns an unreachable GitHub into a clear 502', async () => {
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    await expect(make().list('app-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('refuses an application that is not built from git', async () => {
    await expect(
      make({ ...APP, gitRepo: null }).list('app-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
