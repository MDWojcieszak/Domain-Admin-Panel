import { ApplicationTier, ReleaseTrigger } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { AgentHealthService } from '../agent/agent-health.service';
import { DeployAgentGateway } from '../agent/deploy-agent.gateway';
import { ContainerDiscoveryService } from '../discovery/container-discovery.service';
import { DeployNotificationService } from '../notifications/deploy-notification.service';
import { ReleaseService } from './release.service';
import { UpdatePollerService } from './update-poller.service';

const APP = {
  id: 'app-1',
  slug: 'immich',
  image: 'ghcr.io/immich-app/immich-server',
  tier: ApplicationTier.APPLICATION,
  spec: { pollForUpdates: true },
  availableDigest: null as string | null,
  currentRelease: { digest: 'sha256:old' },
};

describe('UpdatePollerService', () => {
  let prisma: any;
  let agent: any;
  let health: any;
  let discovery: any;
  let releases: any;
  let notifications: any;
  let websocket: any;
  let service: UpdatePollerService;

  const build = () =>
    new UpdatePollerService(
      prisma as PrismaService,
      agent as DeployAgentGateway,
      health as AgentHealthService,
      discovery as ContainerDiscoveryService,
      releases as ReleaseService,
      notifications as DeployNotificationService,
      websocket as WebsocketGateway,
    );

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });

    prisma = {
      application: {
        findMany: jest.fn().mockResolvedValue([{ ...APP }]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    agent = {
      checkForUpdate: jest
        .fn()
        .mockResolvedValue({ current: 'sha256:old', available: 'sha256:new' }),
    };
    health = { health: jest.fn().mockReturnValue({ online: true }) };
    discovery = { stack: jest.fn().mockReturnValue({ project: 'immich' }) };
    releases = { create: jest.fn().mockResolvedValue({ releaseId: 'rel-1' }) };
    notifications = {
      updateAvailable: jest.fn().mockResolvedValue(undefined),
    };
    websocket = { emitToRoom: jest.fn() };

    service = build();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const poll = async () => {
    const running = service.poll();
    await jest.runAllTimersAsync();
    await running;
  };

  it('does nothing while the agent is offline', async () => {
    health.health.mockReturnValue({ online: false });

    await poll();

    expect(prisma.application.findMany).not.toHaveBeenCalled();
  });

  it('records a newer digest and announces it', async () => {
    await poll();

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availableDigest: 'sha256:new' }),
      }),
    );
    expect(notifications.updateAvailable).toHaveBeenCalledWith(
      'immich',
      'sha256:new',
    );
    expect(websocket.emitToRoom).toHaveBeenCalledWith(
      'deployments',
      'application.update-available',
      expect.objectContaining({ digest: 'sha256:new' }),
    );
  });

  it('skips applications that did not opt in', async () => {
    prisma.application.findMany.mockResolvedValue([
      { ...APP, spec: { pollForUpdates: false } },
    ]);

    await poll();

    expect(agent.checkForUpdate).not.toHaveBeenCalled();
  });

  it('does nothing when the registry matches what runs', async () => {
    agent.checkForUpdate.mockResolvedValue({
      current: 'sha256:old',
      available: 'sha256:old',
    });

    await poll();

    expect(prisma.application.update).not.toHaveBeenCalled();
    expect(notifications.updateAvailable).not.toHaveBeenCalled();
  });

  // Otherwise the same update would be mailed every six hours forever.
  it('does not re-announce a digest it already reported', async () => {
    prisma.application.findMany.mockResolvedValue([
      { ...APP, availableDigest: 'sha256:new' },
    ]);

    await poll();

    expect(notifications.updateAvailable).not.toHaveBeenCalled();
  });

  it('clears a recorded update once it has been deployed', async () => {
    prisma.application.findMany.mockResolvedValue([
      { ...APP, availableDigest: 'sha256:new' },
    ]);
    agent.checkForUpdate.mockResolvedValue({
      current: 'sha256:new',
      available: 'sha256:new',
    });

    await poll();

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availableDigest: null }),
      }),
    );
  });

  describe('autoUpdate', () => {
    it('deploys automatically when asked', async () => {
      prisma.application.findMany.mockResolvedValue([
        { ...APP, spec: { pollForUpdates: true, autoUpdate: true } },
      ]);

      await poll();

      expect(releases.create).toHaveBeenCalledWith('app-1', {
        digest: 'sha256:new',
        trigger: ReleaseTrigger.AUTO_UPDATE,
      });
    });

    it('never deploys automatically without opting in', async () => {
      await poll();

      expect(releases.create).not.toHaveBeenCalled();
    });

    // Restarting the database because a tag moved is the wrong kind of surprise.
    it('refuses to auto-update infrastructure, but still reports it', async () => {
      prisma.application.findMany.mockResolvedValue([
        {
          ...APP,
          tier: ApplicationTier.INFRASTRUCTURE,
          spec: { pollForUpdates: true, autoUpdate: true },
        },
      ]);

      await poll();

      expect(releases.create).not.toHaveBeenCalled();
      expect(notifications.updateAvailable).toHaveBeenCalled();
    });

    // I13 rejecting a concurrent deployment is expected, not a failure.
    it('survives a deployment already being in flight', async () => {
      prisma.application.findMany.mockResolvedValue([
        { ...APP, spec: { pollForUpdates: true, autoUpdate: true } },
      ]);
      releases.create.mockRejectedValue(new Error('already in progress'));

      await expect(poll()).resolves.toBeUndefined();
    });
  });

  it('keeps sweeping after one application fails', async () => {
    prisma.application.findMany.mockResolvedValue([
      { ...APP, id: 'app-1', slug: 'broken' },
      { ...APP, id: 'app-2', slug: 'immich' },
    ]);
    agent.checkForUpdate
      .mockRejectedValueOnce(new Error('registry unreachable'))
      .mockResolvedValue({ current: 'sha256:old', available: 'sha256:new' });

    await poll();

    expect(agent.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(notifications.updateAvailable).toHaveBeenCalledWith(
      'immich',
      'sha256:new',
    );
  });
});
