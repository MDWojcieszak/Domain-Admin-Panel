import {
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommandRuntimeStatus, ContainerOrigin } from '@prisma/client';

import { ServerOutboundMessagingService } from '../../server-outbound/server-outbound-messaging.service';
import { DiscoveredStack } from '../discovery/container-classifier';
import { AgentHealthService } from './agent-health.service';
import { DeployAgentGateway } from './deploy-agent.gateway';

const stack = (overrides: Partial<DiscoveredStack> = {}): DiscoveredStack => ({
  project: 'immich',
  origin: ContainerOrigin.ADOPTABLE,
  slug: null,
  workingDir: '/mnt/VAULT/APPS/immich',
  configFiles: ['/mnt/VAULT/APPS/immich/compose.yaml'],
  runtimeStatus: CommandRuntimeStatus.RUNNING,
  containers: [],
  allowedActions: ['start', 'restart', 'stop', 'logs', 'adopt'],
  ...overrides,
});

describe('DeployAgentGateway', () => {
  let outbound: jest.Mocked<
    Pick<ServerOutboundMessagingService, 'emitToQueue' | 'sendToQueue'>
  >;
  let health: { health: jest.Mock };
  let gateway: DeployAgentGateway;

  beforeEach(() => {
    outbound = {
      emitToQueue: jest.fn(),
      sendToQueue: jest.fn().mockResolvedValue({ accepted: true }),
    } as never;

    health = { health: jest.fn().mockReturnValue({ online: true }) };

    gateway = new DeployAgentGateway(
      outbound as unknown as ServerOutboundMessagingService,
      health as unknown as AgentHealthService,
    );
  });

  describe('requestSnapshot', () => {
    it('emits a fire-and-forget request', async () => {
      await gateway.requestSnapshot('panel refresh');

      expect(outbound.emitToQueue).toHaveBeenCalledWith(
        'deploy-agent.commands',
        'containers.snapshot-request',
        expect.objectContaining({ reason: 'panel refresh' }),
      );
    });
  });

  describe('runStackAction', () => {
    it('acts on one container only, through the docker API', async () => {
      const withContainers = stack({
        containers: [
          {
            id: 'c1',
            name: 'immich-server',
            image: 'x',
            state: 'running',
            labels: {},
          },
          {
            id: 'c2',
            name: 'immich-ml',
            image: 'y',
            state: 'running',
            labels: {},
          },
        ],
      });

      await gateway.runStackAction(withContainers, 'stop', 'c2');

      expect(outbound.sendToQueue).toHaveBeenCalledWith(
        'deploy-agent.commands',
        'stack.action',
        expect.objectContaining({ containerIds: ['c2'], containersOnly: true }),
      );
    });

    it('refuses a container that is not part of the stack', async () => {
      await expect(
        gateway.runStackAction(stack(), 'restart', 'not-mine'),
      ).rejects.toThrow(/not part of stack/);
    });

    it('sends the action with the stack paths', async () => {
      await gateway.runStackAction(stack(), 'restart');

      expect(outbound.sendToQueue).toHaveBeenCalledWith(
        'deploy-agent.commands',
        'stack.action',
        expect.objectContaining({
          action: 'restart',
          project: 'immich',
          runDirectory: '/mnt/VAULT/APPS/immich',
        }),
      );
    });

    // I11 — a TrueNAS-managed app accepts a restart but never a stop.
    it('refuses an action the stack origin does not permit', async () => {
      const truenas = stack({
        origin: ContainerOrigin.TRUENAS,
        allowedActions: ['restart', 'logs'],
      });

      await expect(gateway.runStackAction(truenas, 'stop')).rejects.toThrow(
        BadRequestException,
      );
      expect(outbound.sendToQueue).not.toHaveBeenCalled();
    });

    it('permits a restart of a TrueNAS-managed stack', async () => {
      const truenas = stack({
        origin: ContainerOrigin.TRUENAS,
        allowedActions: ['restart', 'logs'],
      });

      await expect(gateway.runStackAction(truenas, 'restart')).resolves.toEqual(
        { accepted: true },
      );
    });

    // Failing fast beats waiting out the timeout for an answer that is not coming.
    it('refuses to send while the agent is offline', async () => {
      health.health.mockReturnValue({ online: false });

      await expect(gateway.runStackAction(stack(), 'restart')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(outbound.sendToQueue).not.toHaveBeenCalled();
    });

    it('gives up when the agent does not answer in time', async () => {
      jest.useFakeTimers();
      outbound.sendToQueue.mockReturnValue(new Promise(() => undefined));

      const pending = gateway.runStackAction(stack(), 'restart');
      const assertion = expect(pending).rejects.toThrow(
        GatewayTimeoutException,
      );

      await jest.advanceTimersByTimeAsync(15_000);
      await assertion;

      jest.useRealTimers();
    });
  });

  describe('fetchLogs', () => {
    it('asks for the requested number of lines', async () => {
      outbound.sendToQueue.mockResolvedValue({ lines: ['a', 'b'] });

      const result = await gateway.fetchLogs(stack(), 500);

      expect(result.lines).toEqual(['a', 'b']);
      expect(outbound.sendToQueue).toHaveBeenCalledWith(
        'deploy-agent.commands',
        'stack.logs',
        expect.objectContaining({ tail: 500 }),
      );
    });

    it('allows logs for every origin, including TrueNAS-managed stacks', async () => {
      outbound.sendToQueue.mockResolvedValue({ lines: [] });

      await expect(
        gateway.fetchLogs(
          stack({
            origin: ContainerOrigin.TRUENAS,
            allowedActions: ['restart', 'logs'],
          }),
          100,
        ),
      ).resolves.toEqual({ lines: [] });
    });
  });
});
