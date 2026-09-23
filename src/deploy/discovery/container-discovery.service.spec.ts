import { NotFoundException } from '@nestjs/common';
import { CommandRuntimeStatus } from '@prisma/client';

import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { RuntimeStatusService } from '../agent/runtime-status.service';
import { COMPOSE_LABELS, HOMELAB_LABELS } from './container-classifier';
import { ContainerDiscoveryService } from './container-discovery.service';

const websocket = () =>
  ({ emitToRoom: jest.fn() }) as unknown as WebsocketGateway;

const runtimeStatus = () =>
  ({
    apply: jest.fn().mockResolvedValue(undefined),
  }) as unknown as RuntimeStatusService;

const container = (id: string, labels: Record<string, string> = {}) => ({
  id,
  name: `container-${id}`,
  image: 'nginx:1.27',
  state: 'running',
  labels,
});

describe('ContainerDiscoveryService', () => {
  let ws: WebsocketGateway;
  let runtime: RuntimeStatusService;
  let service: ContainerDiscoveryService;

  beforeEach(() => {
    ws = websocket();
    runtime = runtimeStatus();
    service = new ContainerDiscoveryService(ws, runtime);
  });

  // "Nothing reported yet" and "nothing running" must not look the same.
  it('reports an unknown view before the agent has said anything', () => {
    const snapshot = service.snapshot();

    expect(snapshot.known).toBe(false);
    expect(snapshot.receivedAt).toBeNull();
    expect(snapshot.stacks).toEqual([]);
  });

  it('replaces the whole view on a snapshot', async () => {
    await service.applySnapshot([container('a'), container('b')]);
    expect(service.stacks()).toHaveLength(2);

    await service.applySnapshot([container('c')]);
    expect(service.stacks()).toHaveLength(1);
    expect(service.snapshot().known).toBe(true);
  });

  it('adds and removes a single container on a change event', async () => {
    await service.applySnapshot([container('a')]);

    await service.applyChange(container('b'));
    expect(service.stacks()).toHaveLength(2);

    await service.applyChange(container('b'), true);
    expect(service.stacks()).toHaveLength(1);
  });

  it('persists runtime status for managed stacks only', async () => {
    await service.applySnapshot([
      container('managed', {
        [COMPOSE_LABELS.project]: 'gallery',
        [HOMELAB_LABELS.app]: 'photo-gallery-backend',
      }),
      container('foreign', { [COMPOSE_LABELS.project]: 'immich' }),
    ]);

    expect(runtime.apply).toHaveBeenCalledTimes(1);
    expect(runtime.apply).toHaveBeenCalledWith(
      'photo-gallery-backend',
      CommandRuntimeStatus.RUNNING,
      expect.any(String),
    );
  });

  it('notifies the deployments room on a snapshot and on a change', async () => {
    await service.applySnapshot([container('a')]);
    await service.applyChange(container('a'));

    expect(ws.emitToRoom).toHaveBeenCalledWith(
      'deployments',
      'containers.snapshot',
      expect.anything(),
    );
    expect(ws.emitToRoom).toHaveBeenCalledWith(
      'deployments',
      'container.changed',
      expect.objectContaining({ id: 'a' }),
    );
  });

  it('throws for a stack the agent has not reported', async () => {
    await service.applySnapshot([container('a')]);

    expect(() => service.stack('nope')).toThrow(NotFoundException);
  });

  // §13.3 — a stale "running" presented as current is worse than a gap.
  it('drops the view when told to forget', async () => {
    await service.applySnapshot([container('a')]);
    service.forget();

    expect(service.snapshot().known).toBe(false);
    expect(service.stacks()).toEqual([]);
  });
});
