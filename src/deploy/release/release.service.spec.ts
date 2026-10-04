import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AppSourceType,
  ApplicationTier,
  BuildMode,
  Prisma,
  ReleaseStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { DeployAgentGateway } from '../agent/deploy-agent.gateway';
import { AuditService } from '../audit/audit.service';
import { DeployRenderService } from '../renderer/deploy-render.service';
import { DeployNotificationService } from '../notifications/deploy-notification.service';
import { LogRedactionService } from '../secrets/log-redaction.service';
import { ReleaseService } from './release.service';

const APP = {
  id: 'app-1',
  slug: 'photo-gallery-backend',
  tier: ApplicationTier.APPLICATION,
  buildMode: BuildMode.REGISTRY,
  spec: { port: 3000 },
  currentRelease: null as { version?: string } | null,
};

const GIT_APP = {
  ...APP,
  sourceType: AppSourceType.GIT,
  gitRepo: {
    id: 'repo-1',
    repo: 'MDWojcieszak/photo-gallery-backend',
    branch: 'main',
    clonePath: null,
  },
};

const PREVIEW = {
  compose: 'services:\n  app:\n    image: x:1\n',
  composeHash: 'hash-abc',
  env: 'KEY=value\n',
  envKeys: ['KEY'],
  missingKeys: [] as string[],
  previousCompose: null,
  changed: true,
};

describe('ReleaseService', () => {
  let prisma: any;
  let render: any;
  let agent: any;
  let audit: any;
  let websocket: any;
  let redaction: any;
  let notifications: any;
  let service: ReleaseService;

  const transaction = (impl: any) => jest.fn((cb: any) => cb(impl));

  beforeEach(() => {
    prisma = {
      application: {
        findFirst: jest.fn().mockResolvedValue({ ...APP }),
        update: jest.fn().mockResolvedValue({}),
      },
      release: {
        update: jest.fn().mockResolvedValue({
          applicationId: APP.id,
          version: '0.3.0',
          application: { slug: APP.slug },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: transaction({
        process: { create: jest.fn().mockResolvedValue({ id: 'proc-1' }) },
        release: {
          create: jest.fn().mockResolvedValue({ id: 'rel-1' }),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        application: { update: jest.fn().mockResolvedValue({}) },
      }),
    };

    render = {
      renderForDeploy: jest
        .fn()
        .mockResolvedValue({ ...PREVIEW, secretValues: ['hunter2'] }),
      hash: jest.fn().mockReturnValue('hash-abc'),
    };
    redaction = { register: jest.fn(), forget: jest.fn() };
    notifications = {
      releaseFailed: jest.fn().mockResolvedValue(undefined),
      rolledBack: jest.fn().mockResolvedValue(undefined),
    };
    agent = { sendDeploy: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    websocket = { emitToRoom: jest.fn() };

    service = new ReleaseService(
      prisma as PrismaService,
      render as DeployRenderService,
      agent as DeployAgentGateway,
      audit as AuditService,
      websocket as WebsocketGateway,
      redaction as LogRedactionService,
      notifications as DeployNotificationService,
    );
  });

  describe('create', () => {
    it('deploys when the approved hash still matches', async () => {
      const result = await service.create('app-1', {
        composeHash: 'hash-abc',
      });

      expect(result).toEqual({ releaseId: 'rel-1', processId: 'proc-1' });
      expect(agent.sendDeploy).toHaveBeenCalledTimes(1);
      expect(prisma.release.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ReleaseStatus.DEPLOYING },
        }),
      );
    });

    it('passes the chosen commit or tag to the agent for a git application', async () => {
      prisma.application.findFirst.mockResolvedValue({ ...GIT_APP });

      await service.create('app-1', { composeHash: 'hash-abc', ref: 'v1.4.0' });

      expect(agent.sendDeploy).toHaveBeenCalledWith(
        expect.objectContaining({
          git: expect.objectContaining({ branch: 'main', commit: 'v1.4.0' }),
        }),
      );
    });

    it('gives each application its own clone, ref and project — v1 and v2 side by side', async () => {
      prisma.application.findFirst.mockResolvedValue({
        ...GIT_APP,
        slug: 'gallery-v1',
        gitRef: 'v1',
      });

      await service.create('app-1', { composeHash: 'hash-abc' });

      const sent = agent.sendDeploy.mock.calls[0][0];
      expect(sent.git).toMatchObject({
        branch: 'v1',
        clonePath:
          '/mnt/VAULT/APPS/repos/MDWojcieszak/photo-gallery-backend@gallery-v1',
        composeInRepository: true,
      });
      expect(sent.spec.projectName).toBe('gallery-v1');
    });

    it('sends the panel file for the clone when the panel keeps it', async () => {
      prisma.application.findFirst.mockResolvedValue({
        ...GIT_APP,
        compose: 'services:\n  web:\n    build: .\n',
      });

      await service.create('app-1', { composeHash: 'hash-abc' });

      expect(agent.sendDeploy.mock.calls[0][0].git.composeInRepository).toBe(
        false,
      );
    });

    it('follows the branch head when no commit or tag is chosen', async () => {
      prisma.application.findFirst.mockResolvedValue({ ...GIT_APP });

      await service.create('app-1', { composeHash: 'hash-abc' });

      expect(agent.sendDeploy).toHaveBeenCalledWith(
        expect.objectContaining({
          git: expect.objectContaining({ commit: null }),
        }),
      );
    });

    it('refuses a commit or tag for an application not deployed from git', async () => {
      await expect(
        service.create('app-1', { composeHash: 'hash-abc', ref: 'v1.4.0' }),
      ).rejects.toThrow(BadRequestException);
      expect(agent.sendDeploy).not.toHaveBeenCalled();
    });

    // I4 — armed before the agent can emit a single line, otherwise the first
    // log message could carry a secret straight into the database.
    it('arms log redaction before the command goes out', async () => {
      await service.create('app-1', { composeHash: 'hash-abc' });

      expect(redaction.register).toHaveBeenCalledWith('proc-1', ['hunter2']);

      const registerOrder = redaction.register.mock.invocationCallOrder[0];
      const sendOrder = agent.sendDeploy.mock.invocationCallOrder[0];
      expect(registerOrder).toBeLessThan(sendOrder);
    });

    // I5 — the operator approved a specific rendering, not "whatever renders now".
    it('refuses when the rendering changed since the preview', async () => {
      await expect(
        service.create('app-1', { composeHash: 'stale-hash' }),
      ).rejects.toThrow(ConflictException);

      expect(agent.sendDeploy).not.toHaveBeenCalled();
    });

    // I1 — the bootstrap tier updates itself through the agent's own path.
    it('refuses to deploy a bootstrap-tier application', async () => {
      prisma.application.findFirst.mockResolvedValue({
        ...APP,
        tier: ApplicationTier.BOOTSTRAP,
      });

      await expect(
        service.create('app-1', { composeHash: 'hash-abc' }),
      ).rejects.toThrow(/Bootstrap-tier/);
    });

    // I6 — an undefined variable must block the deploy, not resolve to "".
    it('refuses when variables are still missing', async () => {
      render.renderForDeploy.mockResolvedValue({
        ...PREVIEW,
        compose: null,
        composeHash: null,
        missingKeys: ['DB_PASSWORD'],
      });

      await expect(
        service.create('app-1', { composeHash: 'hash-abc' }),
      ).rejects.toThrow(/DB_PASSWORD/);
    });

    // I13 — enforced by a partial unique index, surfaced as a clear conflict.
    it('refuses a second deployment while one is in flight', async () => {
      prisma.$transaction = jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: '7',
        }),
      );

      await expect(
        service.create('app-1', { composeHash: 'hash-abc' }),
      ).rejects.toThrow(/already in progress/);
    });

    // A command that never left leaves nothing in flight — releasing the lock
    // immediately beats blocking the application until the TTL sweep.
    it('fails the release when the agent cannot be reached', async () => {
      agent.sendDeploy.mockRejectedValue(new Error('agent offline'));

      await expect(
        service.create('app-1', { composeHash: 'hash-abc' }),
      ).rejects.toThrow('agent offline');

      expect(prisma.release.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rel-1' },
          data: expect.objectContaining({ status: ReleaseStatus.FAILED }),
        }),
      );
    });
  });

  describe('applyResult', () => {
    const deploying = {
      id: 'rel-1',
      status: ReleaseStatus.DEPLOYING,
      applicationId: 'app-1',
    };

    it('promotes a healthy deployment to active', async () => {
      prisma.release.findUnique.mockResolvedValue(deploying);

      await service.applyResult({
        releaseId: 'rel-1',
        success: true,
        healthy: true,
        digest: 'sha256:abc',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(websocket.emitToRoom).toHaveBeenCalledWith(
        'deployments',
        'release.status',
        expect.objectContaining({ status: ReleaseStatus.ACTIVE }),
      );
    });

    // A rollback checks this sha out again, so it must be the resolved one.
    it('pins the commit the agent checked out on the active release', async () => {
      const tx = {
        release: {
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        application: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction = transaction(tx);
      prisma.release.findUnique.mockResolvedValue(deploying);

      await service.applyResult({
        releaseId: 'rel-1',
        success: true,
        healthy: true,
        commit: 'a1b2c3d4e5f6',
      });

      expect(tx.release.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ commit: 'a1b2c3d4e5f6' }),
        }),
      );
    });

    // I15 — `compose up` exiting 0 says the containers started, nothing more.
    it('fails a deployment whose containers started but never became healthy', async () => {
      prisma.release.findUnique.mockResolvedValue(deploying);

      await service.applyResult({
        releaseId: 'rel-1',
        success: true,
        healthy: false,
      });

      expect(prisma.release.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReleaseStatus.FAILED }),
        }),
      );
    });

    it('records the reason the agent gave', async () => {
      prisma.release.findUnique.mockResolvedValue(deploying);

      await service.applyResult({
        releaseId: 'rel-1',
        success: false,
        healthy: false,
        failureReason: 'image pull failed',
      });

      expect(prisma.release.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failureReason: 'image pull failed' }),
        }),
      );
    });

    // §12.2 — the broker may deliver the same message twice.
    it('ignores a result for a release that already settled', async () => {
      prisma.release.findUnique.mockResolvedValue({
        ...deploying,
        status: ReleaseStatus.ACTIVE,
      });

      await service.applyResult({
        releaseId: 'rel-1',
        success: false,
        healthy: false,
      });

      expect(prisma.release.update).not.toHaveBeenCalled();
    });

    it('forgets the secrets once the release settles, either way', async () => {
      for (const healthy of [true, false]) {
        redaction.forget.mockClear();
        prisma.release.findUnique.mockResolvedValue({
          ...deploying,
          processId: 'proc-1',
        });

        await service.applyResult({
          releaseId: 'rel-1',
          success: true,
          healthy,
        });

        expect(redaction.forget).toHaveBeenCalledWith('proc-1');
      }
    });

    it('ignores a result for an unknown release', async () => {
      prisma.release.findUnique.mockResolvedValue(null);

      await service.applyResult({
        releaseId: 'gone',
        success: true,
        healthy: true,
      });

      expect(prisma.release.update).not.toHaveBeenCalled();
    });
  });

  describe('sweepStale', () => {
    // UNKNOWN, not FAILED: the deployment may well have worked — what is
    // missing is the report, and claiming failure would be a guess.
    it('marks timed-out releases unknown rather than failed', async () => {
      prisma.release.findMany.mockResolvedValue([
        { id: 'rel-1', applicationId: 'app-1' },
      ]);

      const swept = await service.sweepStale();

      expect(swept).toBe(1);
      expect(prisma.release.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReleaseStatus.UNKNOWN }),
        }),
      );
    });

    it('does nothing when everything settled in time', async () => {
      expect(await service.sweepStale()).toBe(0);
      expect(prisma.release.update).not.toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    it('redeploys the stored bytes instead of re-rendering', async () => {
      prisma.release.findUnique.mockResolvedValue({
        id: 'rel-old',
        version: '0.2.0',
        digest: 'sha256:old',
        renderedCompose: 'services:\n  app:\n    image: x:0.2.0\n',
        renderedEnvKeys: ['KEY'],
        application: { ...APP },
      });

      await service.rollback('rel-old');

      expect(agent.sendDeploy).toHaveBeenCalledWith(
        expect.objectContaining({
          compose: 'services:\n  app:\n    image: x:0.2.0\n',
        }),
      );
    });

    it('checks out the commit the target release ran for a git application', async () => {
      prisma.release.findUnique.mockResolvedValue({
        id: 'rel-old',
        commit: 'a1b2c3d4e5f6',
        renderedCompose: 'services:\n  app:\n    build: .\n',
        renderedEnvKeys: [],
        application: { ...GIT_APP },
      });

      await service.rollback('rel-old');

      expect(agent.sendDeploy).toHaveBeenCalledWith(
        expect.objectContaining({
          git: expect.objectContaining({ commit: 'a1b2c3d4e5f6' }),
        }),
      );
    });

    // Without a sha the agent would deploy the branch head under the old
    // compose file — a rollback in name only.
    it('refuses to roll back a git application whose release recorded no commit', async () => {
      prisma.release.findUnique.mockResolvedValue({
        id: 'rel-old',
        commit: null,
        renderedCompose: 'services:\n  app:\n    build: .\n',
        renderedEnvKeys: [],
        application: { ...GIT_APP },
      });

      await expect(service.rollback('rel-old')).rejects.toThrow(
        BadRequestException,
      );
      expect(agent.sendDeploy).not.toHaveBeenCalled();
    });

    it('refuses to roll back to a release with no stored configuration', async () => {
      prisma.release.findUnique.mockResolvedValue({
        id: 'rel-old',
        renderedCompose: null,
        renderedEnvKeys: [],
        application: { ...APP },
      });

      await expect(service.rollback('rel-old')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
