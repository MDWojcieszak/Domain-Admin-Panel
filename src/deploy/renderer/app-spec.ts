import { BadRequestException } from '@nestjs/common';

/**
 * Declarative description of a single application, stored in
 * `Application.spec`. The renderer turns it into a compose file plus an env
 * file; see docs/deploy-design.md §9.1.
 *
 * Everything here is deliberately small: the conventions the renderer adds on
 * top (restart policy, log rotation, identifying labels, Traefik wiring) are
 * NOT expressible in the spec, precisely so they cannot be forgotten per app.
 */

export interface AppSpecVolume {
  /** Absolute path on the host, normally under the storage pool. */
  host: string;
  /** Mount point inside the container. */
  path: string;
  readOnly?: boolean;
}

export interface AppSpecBuild {
  /** Build context — a host path, or a path relative to the run directory. */
  context: string;
  dockerfile?: string;
  /** Multi-stage target, when the Dockerfile has several. */
  target?: string;
  /** `--build-arg` pairs. Never put a secret here: build args end up in the image. */
  args?: Record<string, string>;
  /** Extra flags for `compose build`, e.g. --no-cache. */
  extraArgs?: string[];
}

export interface AppSpecResources {
  /** Compose memory limit, e.g. "2G". */
  memory?: string;
  /** Compose CPU limit, e.g. "2.0". */
  cpus?: string;
}

export interface AppSpec {
  // — network and exposure —
  /** Port the application listens on inside the container. */
  port?: number;
  /** HTTP path used for the container healthcheck, e.g. "/health". */
  health?: string;
  /**
   * Overrides the generated healthcheck command entirely. Needed for images
   * without `wget`, since a wrong healthcheck makes the deploy health gate
   * (§12.5) fail a perfectly good release.
   */
  healthCommand?: string[];
  /** Public hostname routed by Traefik. Absent means no ingress. */
  domain?: string;
  /** Host port to publish. Absent means the container is reachable only over the shared network. */
  publishPort?: number;
  /** Shared external docker network. */
  network?: string;

  // — data —
  volumes?: AppSpecVolume[];
  /**
   * Slugs of applications this one needs. These live in their own compose
   * stacks, so they are NOT emitted as `depends_on` — compose cannot express a
   * cross-stack dependency. They are recorded as a label and used by the panel
   * for ordering and for the dependency view.
   */
  depends?: string[];

  resources?: AppSpecResources;

  // — paths (§3, patterned on Komodo) —
  runDirectory?: string;
  filePaths?: string[];
  envFilePath?: string;
  /** Extra files tracked for change detection, e.g. "nginx.conf". */
  configFiles?: string[];

  /** Only meaningful with buildMode COMPOSE; see D6. */
  build?: AppSpecBuild;

  // — deploy behaviour —
  projectName?: string;
  autoPull?: boolean;
  destroyBeforeDeploy?: boolean;
  preDeploy?: string | null;
  postDeploy?: string | null;
  extraArgs?: string[];
  /** Services excluded from the health gate, e.g. one-shot jobs. */
  ignoreServices?: string[];

  // — reliability (§12) —
  /** Seconds the health gate waits after `up -d`. */
  healthTimeout?: number;
  /**
   * Redeploy the previous release when the health gate fails. Defaults to
   * false: an app that migrates its database on start is usually made worse by
   * rolling the image back onto an already-migrated schema (§12.5).
   */
  autoRollback?: boolean;

  // — image updates —
  pollForUpdates?: boolean;
  autoUpdate?: boolean;
}

export const APP_SPEC_DEFAULTS = {
  network: 'homelab',
  runDirectory: '.',
  filePaths: ['compose.yaml'],
  envFilePath: '.env',
  autoPull: true,
  destroyBeforeDeploy: false,
  healthTimeout: 120,
  autoRollback: false,
  pollForUpdates: false,
  autoUpdate: false,
} as const;

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ENV_FILE_NAME = /^(?!.*\.\.)[A-Za-z0-9._-]+$/;
const ABSOLUTE_PATH = /^\//;

const reject = (message: string): never => {
  throw new BadRequestException(`Invalid application spec: ${message}`);
};

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    reject(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const asStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    reject(`${label} must be an array of strings.`);
  }
  return value as string[];
};

const asStringRecord = (
  value: unknown,
  label: string,
): Record<string, string> => {
  const record = asRecord(value, label);

  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string') {
      reject(`${label}.${key} must be a string.`);
    }
  }

  return record as Record<string, string>;
};

const asPort = (value: unknown, label: string): number => {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    reject(`${label} must be an integer between 1 and 65535.`);
  }
  return value as number;
};

/**
 * Validates a raw `Application.spec` and fills in defaults. Rejects rather than
 * guesses: a spec that renders to a subtly wrong compose file is worse than one
 * that refuses to render.
 */
export const parseAppSpec = (
  raw: unknown,
): Required<
  Pick<
    AppSpec,
    | 'network'
    | 'runDirectory'
    | 'filePaths'
    | 'envFilePath'
    | 'autoPull'
    | 'destroyBeforeDeploy'
    | 'healthTimeout'
    | 'autoRollback'
    | 'pollForUpdates'
    | 'autoUpdate'
  >
> &
  AppSpec => {
  const spec = asRecord(raw ?? {}, 'spec');

  const port = spec.port === undefined ? undefined : asPort(spec.port, 'port');
  const publishPort =
    spec.publishPort === undefined
      ? undefined
      : asPort(spec.publishPort, 'publishPort');

  const domain = spec.domain === undefined ? undefined : String(spec.domain);
  // §9.4.4 — a router with no target is a configuration error, not a default.
  if (domain && port === undefined) {
    reject('domain requires port — a Traefik router needs a target port.');
  }
  if (publishPort !== undefined && port === undefined) {
    reject('publishPort requires port.');
  }

  const health = spec.health === undefined ? undefined : String(spec.health);
  if (health && !health.startsWith('/')) {
    reject('health must be an absolute path, e.g. "/health".');
  }
  if (health && port === undefined) {
    reject(
      'health requires port — the healthcheck needs somewhere to connect.',
    );
  }

  const volumes = (spec.volumes ?? []) as unknown[];
  if (!Array.isArray(volumes)) reject('volumes must be an array.');
  const parsedVolumes: AppSpecVolume[] = volumes.map((entry, index) => {
    const volume = asRecord(entry, `volumes[${index}]`);
    const host = String(volume.host ?? '');
    const path = String(volume.path ?? '');

    if (!ABSOLUTE_PATH.test(host)) {
      reject(`volumes[${index}].host must be an absolute path.`);
    }
    if (!ABSOLUTE_PATH.test(path)) {
      reject(`volumes[${index}].path must be an absolute path.`);
    }

    return { host, path, readOnly: volume.readOnly === true };
  });

  const healthTimeout =
    spec.healthTimeout === undefined
      ? APP_SPEC_DEFAULTS.healthTimeout
      : Number(spec.healthTimeout);
  if (!Number.isInteger(healthTimeout) || healthTimeout < 1) {
    reject('healthTimeout must be a positive integer number of seconds.');
  }

  const filePaths =
    spec.filePaths === undefined
      ? [...APP_SPEC_DEFAULTS.filePaths]
      : asStringArray(spec.filePaths, 'filePaths');
  if (filePaths.length === 0) reject('filePaths must not be empty.');

  let parsedBuild: AppSpecBuild | undefined;
  if (spec.build !== undefined) {
    const build = asRecord(spec.build, 'build');
    const context = String(build.context ?? '');

    if (!context) reject('build.context is required when build is set.');

    parsedBuild = {
      context,
      dockerfile:
        build.dockerfile === undefined ? undefined : String(build.dockerfile),
      target: build.target === undefined ? undefined : String(build.target),
      args:
        build.args === undefined
          ? undefined
          : asStringRecord(build.args, 'build.args'),
      extraArgs:
        build.extraArgs === undefined
          ? []
          : asStringArray(build.extraArgs, 'build.extraArgs'),
    };
  }

  const envFilePath = String(spec.envFilePath ?? APP_SPEC_DEFAULTS.envFilePath);
  if (!ENV_FILE_NAME.test(envFilePath)) {
    reject('envFilePath must be a relative file name without "..".');
  }

  return {
    port,
    health,
    healthCommand:
      spec.healthCommand === undefined
        ? undefined
        : asStringArray(spec.healthCommand, 'healthCommand'),
    domain,
    publishPort,
    network: String(spec.network ?? APP_SPEC_DEFAULTS.network),

    volumes: parsedVolumes,
    depends:
      spec.depends === undefined ? [] : asStringArray(spec.depends, 'depends'),

    resources:
      spec.resources === undefined
        ? undefined
        : {
            memory:
              (spec.resources as AppSpecResources).memory === undefined
                ? undefined
                : String((spec.resources as AppSpecResources).memory),
            cpus:
              (spec.resources as AppSpecResources).cpus === undefined
                ? undefined
                : String((spec.resources as AppSpecResources).cpus),
          },

    runDirectory: String(spec.runDirectory ?? APP_SPEC_DEFAULTS.runDirectory),
    filePaths,
    envFilePath,
    configFiles:
      spec.configFiles === undefined
        ? []
        : asStringArray(spec.configFiles, 'configFiles'),

    build: parsedBuild,

    projectName:
      spec.projectName === undefined ? undefined : String(spec.projectName),
    autoPull:
      spec.autoPull !== undefined
        ? spec.autoPull === true
        : APP_SPEC_DEFAULTS.autoPull,
    destroyBeforeDeploy: spec.destroyBeforeDeploy === true,
    preDeploy: spec.preDeploy === undefined ? null : String(spec.preDeploy),
    postDeploy: spec.postDeploy === undefined ? null : String(spec.postDeploy),
    extraArgs:
      spec.extraArgs === undefined
        ? []
        : asStringArray(spec.extraArgs, 'extraArgs'),
    ignoreServices:
      spec.ignoreServices === undefined
        ? []
        : asStringArray(spec.ignoreServices, 'ignoreServices'),

    healthTimeout,
    autoRollback: spec.autoRollback === true,

    pollForUpdates: spec.pollForUpdates === true,
    autoUpdate: spec.autoUpdate === true,
  };
};

export const assertEnvKey = (key: string): void => {
  if (!ENV_KEY.test(key)) {
    throw new BadRequestException(
      `Invalid environment key "${key}": expected [A-Za-z_][A-Za-z0-9_]*.`,
    );
  }
};
