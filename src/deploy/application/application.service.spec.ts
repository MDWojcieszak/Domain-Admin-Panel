import {
  ApplicationService,
  toApplicationResponse,
} from './application.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('toApplicationResponse', () => {
  it('never returns the webhook secret, only whether one exists (I3)', () => {
    const response = toApplicationResponse({
      id: 'app1',
      slug: 'photo-gallery-backend',
      webhookSecret: 'encrypted-ciphertext',
      webhookEnabled: true,
      spec: { port: 3000 },
      currentRelease: null,
    } as any);

    expect(JSON.stringify(response)).not.toContain('encrypted-ciphertext');
    expect(response).not.toHaveProperty('webhookSecret');
    expect(response.hasWebhookSecret).toBe(true);
  });
});

describe('ApplicationService.moveToGit', () => {
  const make = (app: Record<string, unknown>) => {
    const prisma: any = {
      application: {
        findFirst: jest.fn().mockResolvedValue(app),
        update: jest.fn().mockResolvedValue(app),
      },
      gitRepo: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'r1', name: 'photo-gallery' }),
      },
    };
    const audit: any = { record: jest.fn() };
    const render: any = { validateSpec: jest.fn() };
    const service = new ApplicationService(
      prisma,
      {} as any,
      audit,
      render,
      {} as any,
    );
    jest.spyOn(service, 'get').mockResolvedValue({} as any);
    return { service, prisma };
  };

  it('keeps the running project name, so containers are updated, not duplicated (I10)', async () => {
    const { service, prisma } = make({
      id: 'a1',
      slug: 'photo-gallery',
      tier: 'APPLICATION',
      sourceType: 'HOST',
      gitRepoId: null,
      spec: { projectName: 'photo-gallery-legacy', healthTimeout: 60 },
    });

    await service.moveToGit('a1', {
      gitRepoId: 'r1',
      composeFile: 'docker-compose.yaml',
    });

    const data = prisma.application.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      sourceType: 'GIT',
      origin: 'MANAGED',
      gitRepoId: 'r1',
      buildMode: 'COMPOSE',
      compose: null,
    });
    expect(data.spec).toEqual({
      projectName: 'photo-gallery-legacy',
      healthTimeout: 60,
      runDirectory: '.',
      filePaths: ['docker-compose.yaml'],
    });
  });

  it('pins the slug as project name when none was recorded', async () => {
    const { service, prisma } = make({
      id: 'a1',
      slug: 'blog',
      tier: 'APPLICATION',
      sourceType: 'COMPOSE',
      spec: {},
    });

    await service.moveToGit('a1', { gitRepoId: 'r1' });

    expect(
      prisma.application.update.mock.calls[0][0].data.spec.projectName,
    ).toBe('blog');
  });

  it('refuses the bootstrap tier (I1)', async () => {
    const { service } = make({
      id: 'a1',
      slug: 'agent',
      tier: 'BOOTSTRAP',
      spec: {},
    });

    await expect(service.moveToGit('a1', { gitRepoId: 'r1' })).rejects.toThrow(
      /Bootstrap/,
    );
  });
});

describe('ApplicationService.moveToGit — keeping the panel file', () => {
  const make = (app: Record<string, unknown>) => {
    const prisma: any = {
      application: {
        findFirst: jest.fn().mockResolvedValue(app),
        update: jest.fn().mockResolvedValue(app),
      },
      gitRepo: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r1', name: 'app' }),
      },
    };
    const service = new ApplicationService(
      prisma,
      {} as any,
      { record: jest.fn() } as any,
      { validateSpec: jest.fn() } as any,
      {} as any,
    );
    jest.spyOn(service, 'get').mockResolvedValue({} as any);
    return { service, prisma };
  };

  it('keeps the stored compose file when it is not in the repository', async () => {
    const { service, prisma } = make({
      id: 'a1',
      slug: 'gallery-v1',
      tier: 'APPLICATION',
      sourceType: 'COMPOSE',
      compose: 'services:\n  web:\n    build: .\n',
      spec: {},
    });

    await service.moveToGit('a1', {
      gitRepoId: 'r1',
      gitRef: 'v1',
      composeInRepository: false,
    });

    const data = prisma.application.update.mock.calls[0][0].data;
    expect(data.compose).toBe('services:\n  web:\n    build: .\n');
    expect(data.gitRef).toBe('v1');
  });

  it('refuses to keep a file the panel does not have', async () => {
    const { service } = make({
      id: 'a1',
      slug: 'x',
      tier: 'APPLICATION',
      sourceType: 'HOST',
      compose: null,
      spec: {},
    });

    await expect(
      service.moveToGit('a1', { gitRepoId: 'r1', composeInRepository: false }),
    ).rejects.toThrow(/no compose file kept in the panel/);
  });
});
