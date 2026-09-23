import { CommandRuntimeStatus, ContainerOrigin } from '@prisma/client';

import {
  COMPOSE_LABELS,
  DiscoveredContainer,
  HOMELAB_LABELS,
  aggregateStatus,
  assertActionAllowed,
  containerStatus,
  groupIntoStacks,
} from './container-classifier';

const container = (
  overrides: Partial<DiscoveredContainer> = {},
): DiscoveredContainer => ({
  id: 'c1',
  name: 'app-1',
  image: 'nginx:1.27',
  state: 'running',
  labels: {},
  ...overrides,
});

const composeLabels = (project: string, workingDir: string, files = '') => ({
  [COMPOSE_LABELS.project]: project,
  [COMPOSE_LABELS.workingDir]: workingDir,
  ...(files ? { [COMPOSE_LABELS.configFiles]: files } : {}),
});

describe('containerStatus', () => {
  it.each([
    ['running without healthcheck', { state: 'running' }, 'RUNNING'],
    ['running and healthy', { state: 'running', health: 'healthy' }, 'RUNNING'],
    [
      'running but starting',
      { state: 'running', health: 'starting' },
      'STARTING',
    ],
    [
      'running but unhealthy',
      { state: 'running', health: 'unhealthy' },
      'ERROR',
    ],
    ['created', { state: 'created' }, 'STARTING'],
    ['restarting', { state: 'restarting' }, 'STARTING'],
    ['paused', { state: 'paused' }, 'STOPPING'],
    ['exited cleanly', { state: 'exited', exitCode: 0 }, 'STOPPED'],
    ['exited with an error', { state: 'exited', exitCode: 1 }, 'ERROR'],
    ['dead', { state: 'dead' }, 'ERROR'],
    ['unknown state', { state: 'weird' }, 'IDLE'],
  ])('maps %s', (_label, overrides, expected) => {
    expect(
      containerStatus(container(overrides as Partial<DiscoveredContainer>)),
    ).toBe(expected);
  });

  // An unhealthy container is still "running" to docker; reporting it as RUNNING
  // would let the deploy health gate pass a broken release.
  it('does not let a running state mask an unhealthy container', () => {
    expect(
      containerStatus(container({ state: 'running', health: 'unhealthy' })),
    ).toBe(CommandRuntimeStatus.ERROR);
  });
});

describe('aggregateStatus', () => {
  it('reports IDLE for an empty stack', () => {
    expect(aggregateStatus([])).toBe(CommandRuntimeStatus.IDLE);
  });

  it('lets the worst container decide', () => {
    expect(
      aggregateStatus([
        container({ state: 'running', health: 'healthy' }),
        container({ state: 'running', health: 'unhealthy' }),
      ]),
    ).toBe(CommandRuntimeStatus.ERROR);
  });

  it('prefers STARTING over RUNNING while one service is still coming up', () => {
    expect(
      aggregateStatus([
        container({ state: 'running' }),
        container({ state: 'created' }),
      ]),
    ).toBe(CommandRuntimeStatus.STARTING);
  });

  it('reports RUNNING when a one-shot job has exited cleanly alongside a live service', () => {
    expect(
      aggregateStatus([
        container({ state: 'running' }),
        container({ state: 'exited', exitCode: 0 }),
      ]),
    ).toBe(CommandRuntimeStatus.RUNNING);
  });

  it('reports STOPPED only when everything is stopped', () => {
    expect(
      aggregateStatus([
        container({ state: 'exited', exitCode: 0 }),
        container({ state: 'exited', exitCode: 0 }),
      ]),
    ).toBe(CommandRuntimeStatus.STOPPED);
  });
});

describe('groupIntoStacks', () => {
  it('groups containers by compose project', () => {
    const stacks = groupIntoStacks([
      container({
        id: 'a',
        name: 'immich-server',
        labels: composeLabels('immich', '/mnt/VAULT/APPS/immich'),
      }),
      container({
        id: 'b',
        name: 'immich-redis',
        labels: composeLabels('immich', '/mnt/VAULT/APPS/immich'),
      }),
    ]);

    expect(stacks).toHaveLength(1);
    expect(stacks[0].project).toBe('immich');
    expect(stacks[0].containers).toHaveLength(2);
  });

  it('classifies our own stacks as MANAGED', () => {
    const [stack] = groupIntoStacks([
      container({
        labels: {
          ...composeLabels('photo-gallery', '/mnt/VAULT/APPS/homelab/stacks'),
          [HOMELAB_LABELS.app]: 'photo-gallery-backend',
        },
      }),
    ]);

    expect(stack.origin).toBe(ContainerOrigin.MANAGED);
    expect(stack.slug).toBe('photo-gallery-backend');
    expect(stack.allowedActions).toContain('deploy');
  });

  it('classifies a foreign compose stack as ADOPTABLE', () => {
    const [stack] = groupIntoStacks([
      container({ labels: composeLabels('immich', '/mnt/VAULT/APPS/immich') }),
    ]);

    expect(stack.origin).toBe(ContainerOrigin.ADOPTABLE);
    expect(stack.slug).toBeNull();
    expect(stack.allowedActions).toContain('adopt');
  });

  // I11 — TrueNAS reconciles its own apps, so deploying behind its back gets undone.
  it('classifies apps under /mnt/.ix-apps as TRUENAS with restricted actions', () => {
    const [stack] = groupIntoStacks([
      container({
        labels: composeLabels(
          'plex',
          '/mnt/.ix-apps/app_configs/plex/versions/1.0.0',
        ),
      }),
    ]);

    expect(stack.origin).toBe(ContainerOrigin.TRUENAS);
    expect(stack.allowedActions).toEqual(['restart', 'logs']);
    expect(stack.allowedActions).not.toContain('deploy');
    expect(stack.allowedActions).not.toContain('stop');
    expect(stack.allowedActions).not.toContain('destroy');
  });

  it('treats a container without compose labels as its own STANDALONE stack', () => {
    const [stack] = groupIntoStacks([
      container({ name: 'manual-nginx', labels: {} }),
    ]);

    expect(stack.origin).toBe(ContainerOrigin.STANDALONE);
    expect(stack.project).toBe('manual-nginx');
    expect(stack.allowedActions).not.toContain('adopt');
  });

  it('extracts the working directory and config files needed for adoption', () => {
    const [stack] = groupIntoStacks([
      container({
        labels: composeLabels(
          'immich',
          '/mnt/VAULT/APPS/immich',
          '/mnt/VAULT/APPS/immich/compose.yaml,/mnt/VAULT/APPS/immich/override.yaml',
        ),
      }),
    ]);

    expect(stack.workingDir).toBe('/mnt/VAULT/APPS/immich');
    expect(stack.configFiles).toEqual([
      '/mnt/VAULT/APPS/immich/compose.yaml',
      '/mnt/VAULT/APPS/immich/override.yaml',
    ]);
  });

  it('aggregates status across a stack', () => {
    const [stack] = groupIntoStacks([
      container({
        id: 'a',
        labels: composeLabels('immich', '/mnt/VAULT/APPS/immich'),
      }),
      container({
        id: 'b',
        state: 'exited',
        exitCode: 137,
        labels: composeLabels('immich', '/mnt/VAULT/APPS/immich'),
      }),
    ]);

    expect(stack.runtimeStatus).toBe(CommandRuntimeStatus.ERROR);
  });

  it('returns stacks in a stable order', () => {
    const stacks = groupIntoStacks([
      container({ id: 'a', name: 'zulu', labels: {} }),
      container({ id: 'b', name: 'alpha', labels: {} }),
    ]);

    expect(stacks.map((s) => s.project)).toEqual(['alpha', 'zulu']);
  });
});

describe('assertActionAllowed', () => {
  it('permits a deploy only for managed stacks', () => {
    expect(assertActionAllowed(ContainerOrigin.MANAGED, 'deploy')).toBe(true);
    expect(assertActionAllowed(ContainerOrigin.ADOPTABLE, 'deploy')).toBe(
      false,
    );
    expect(assertActionAllowed(ContainerOrigin.TRUENAS, 'deploy')).toBe(false);
    expect(assertActionAllowed(ContainerOrigin.STANDALONE, 'deploy')).toBe(
      false,
    );
  });

  it('permits adoption only for a foreign compose stack', () => {
    expect(assertActionAllowed(ContainerOrigin.ADOPTABLE, 'adopt')).toBe(true);
    expect(assertActionAllowed(ContainerOrigin.TRUENAS, 'adopt')).toBe(false);
    expect(assertActionAllowed(ContainerOrigin.STANDALONE, 'adopt')).toBe(
      false,
    );
  });

  it('always permits a restart and reading logs', () => {
    for (const origin of Object.values(ContainerOrigin)) {
      expect(assertActionAllowed(origin, 'restart')).toBe(true);
      expect(assertActionAllowed(origin, 'logs')).toBe(true);
    }
  });

  // A restart is transient and survives TrueNAS's reconciler; start and stop
  // change the state it believes it declared, so it would undo them.
  it('permits start and stop everywhere except TrueNAS-managed stacks', () => {
    for (const action of ['start', 'stop'] as const) {
      expect(assertActionAllowed(ContainerOrigin.MANAGED, action)).toBe(true);
      expect(assertActionAllowed(ContainerOrigin.ADOPTABLE, action)).toBe(true);
      expect(assertActionAllowed(ContainerOrigin.STANDALONE, action)).toBe(
        true,
      );
      expect(assertActionAllowed(ContainerOrigin.TRUENAS, action)).toBe(false);
    }
  });
});
