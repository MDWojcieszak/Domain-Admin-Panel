import { CommandRuntimeStatus, ContainerOrigin } from '@prisma/client';

/**
 * Classifies every container on the host into a stack the panel can reason
 * about (docs/deploy-design.md §8.4).
 *
 * Pure functions: the agent reports raw `docker ps` / `docker events` data and
 * everything below is derived from it, so the rules are testable without a
 * docker daemon.
 */

/** Labels docker itself writes onto anything started by compose. */
export const COMPOSE_LABELS = {
  project: 'com.docker.compose.project',
  service: 'com.docker.compose.service',
  workingDir: 'com.docker.compose.project.working_dir',
  configFiles: 'com.docker.compose.project.config_files',
} as const;

/** Labels the renderer adds, marking a stack as ours. */
export const HOMELAB_LABELS = {
  app: 'homelab.app',
  tier: 'homelab.tier',
  release: 'homelab.release',
  depends: 'homelab.depends',
} as const;

/**
 * TrueNAS keeps its own applications here. They are compose stacks, so they are
 * discoverable, but their lifecycle belongs to the TrueNAS middleware.
 */
export const TRUENAS_APPS_PREFIX = '/mnt/.ix-apps/';

export interface DiscoveredContainer {
  id: string;
  name: string;
  image: string;
  imageDigest?: string | null;
  /** Raw docker state: running, exited, restarting, created, paused, dead. */
  state: string;
  /** Raw docker health: healthy, unhealthy, starting — absent when none. */
  health?: string | null;
  /** Exit code, meaningful when `state` is exited. */
  exitCode?: number | null;
  labels: Record<string, string>;
  createdAt?: string | null;
}

export interface DiscoveredStack {
  /** Compose project name, or the container name for standalone containers. */
  project: string;
  origin: ContainerOrigin;
  /** Slug of the managed application, when this stack is ours. */
  slug: string | null;
  workingDir: string | null;
  configFiles: string[];
  runtimeStatus: CommandRuntimeStatus;
  containers: DiscoveredContainer[];
  /** What the panel is allowed to offer for this stack (I11). */
  allowedActions: StackAction[];
}

export type StackAction =
  | 'deploy'
  | 'rollback'
  | 'start'
  | 'restart'
  | 'stop'
  | 'destroy'
  | 'logs'
  | 'adopt';

/** Lifecycle actions the agent can run on any discovered stack. */
export type StackLifecycleAction = Extract<
  StackAction,
  'start' | 'restart' | 'stop'
>;

const ACTIONS_BY_ORIGIN: Record<ContainerOrigin, StackAction[]> = {
  // Ours: the full set.
  MANAGED: [
    'deploy',
    'rollback',
    'start',
    'restart',
    'stop',
    'destroy',
    'logs',
  ],
  // Someone else's compose stack: readable and controllable, and can be taken over.
  ADOPTABLE: ['start', 'restart', 'stop', 'logs', 'adopt'],
  // I11 — TrueNAS reconciles its own apps. A restart is transient and survives,
  // but start and stop change the state TrueNAS believes it declared, so it
  // would simply undo them.
  TRUENAS: ['restart', 'logs'],
  // No compose file to act on, so only the container lifecycle.
  STANDALONE: ['start', 'restart', 'stop', 'logs'],
};

/** Maps one container's docker state onto the shared runtime-status enum. */
export const containerStatus = (
  container: DiscoveredContainer,
): CommandRuntimeStatus => {
  switch (container.state) {
    case 'running':
      if (container.health === 'unhealthy') return CommandRuntimeStatus.ERROR;
      if (container.health === 'starting') return CommandRuntimeStatus.STARTING;
      return CommandRuntimeStatus.RUNNING;

    case 'created':
    case 'restarting':
      return CommandRuntimeStatus.STARTING;

    case 'removing':
    case 'paused':
      return CommandRuntimeStatus.STOPPING;

    case 'exited':
      return container.exitCode
        ? CommandRuntimeStatus.ERROR
        : CommandRuntimeStatus.STOPPED;

    case 'dead':
      return CommandRuntimeStatus.ERROR;

    default:
      return CommandRuntimeStatus.IDLE;
  }
};

/**
 * Aggregates a stack's status from its containers. Worst news wins, so a single
 * unhealthy service is never hidden behind healthy siblings.
 *
 * A mix of running and cleanly exited containers reports RUNNING: a one-shot
 * job that finished is normal, and per-container detail stays available.
 */
export const aggregateStatus = (
  containers: DiscoveredContainer[],
): CommandRuntimeStatus => {
  if (containers.length === 0) return CommandRuntimeStatus.IDLE;

  const statuses = containers.map(containerStatus);

  if (statuses.includes(CommandRuntimeStatus.ERROR)) {
    return CommandRuntimeStatus.ERROR;
  }
  if (statuses.includes(CommandRuntimeStatus.STARTING)) {
    return CommandRuntimeStatus.STARTING;
  }
  if (statuses.includes(CommandRuntimeStatus.STOPPING)) {
    return CommandRuntimeStatus.STOPPING;
  }
  if (statuses.includes(CommandRuntimeStatus.RUNNING)) {
    return CommandRuntimeStatus.RUNNING;
  }
  if (statuses.every((s) => s === CommandRuntimeStatus.STOPPED)) {
    return CommandRuntimeStatus.STOPPED;
  }

  return CommandRuntimeStatus.IDLE;
};

const classifyOrigin = (
  containers: DiscoveredContainer[],
  workingDir: string | null,
): ContainerOrigin => {
  if (containers.some((c) => c.labels[HOMELAB_LABELS.app])) {
    return ContainerOrigin.MANAGED;
  }

  const isCompose = containers.some((c) => c.labels[COMPOSE_LABELS.project]);
  if (!isCompose) return ContainerOrigin.STANDALONE;

  // Normalise separators: the label carries a host path, and TrueNAS is Linux,
  // but the comparison should not hinge on that.
  const normalised = workingDir?.replace(/\\/g, '/') ?? '';

  return normalised.startsWith(TRUENAS_APPS_PREFIX)
    ? ContainerOrigin.TRUENAS
    : ContainerOrigin.ADOPTABLE;
};

/** Compose writes config_files as a comma-separated list of absolute paths. */
const parseConfigFiles = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);

/**
 * Groups a host-wide container list into stacks. Containers that compose never
 * touched are each their own single-container "stack", so the panel can still
 * show and restart them.
 */
export const groupIntoStacks = (
  containers: DiscoveredContainer[],
): DiscoveredStack[] => {
  const groups = new Map<string, DiscoveredContainer[]>();

  for (const container of containers) {
    const project = container.labels[COMPOSE_LABELS.project] || container.name;

    const group = groups.get(project);
    if (group) group.push(container);
    else groups.set(project, [container]);
  }

  const stacks = [...groups.entries()].map(([project, group]) => {
    const withMeta = group.find((c) => c.labels[COMPOSE_LABELS.workingDir]);
    const workingDir = withMeta?.labels[COMPOSE_LABELS.workingDir] ?? null;
    const origin = classifyOrigin(group, workingDir);

    return {
      project,
      origin,
      slug:
        group.find((c) => c.labels[HOMELAB_LABELS.app])?.labels[
          HOMELAB_LABELS.app
        ] ?? null,
      workingDir,
      configFiles: parseConfigFiles(
        group.find((c) => c.labels[COMPOSE_LABELS.configFiles])?.labels[
          COMPOSE_LABELS.configFiles
        ],
      ),
      runtimeStatus: aggregateStatus(group),
      containers: group,
      allowedActions: ACTIONS_BY_ORIGIN[origin],
    };
  });

  return stacks.sort((a, b) => a.project.localeCompare(b.project));
};

/** Guards every action the panel offers for a discovered stack (I11). */
export const assertActionAllowed = (
  origin: ContainerOrigin,
  action: StackAction,
): boolean => ACTIONS_BY_ORIGIN[origin].includes(action);
