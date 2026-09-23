import { BadRequestException, Injectable } from '@nestjs/common';
import { ApplicationTier, BuildMode } from '@prisma/client';

import { AppSpec, assertEnvKey, parseAppSpec } from './app-spec';

// js-yaml ships no bundled types in this project; the same require pattern is
// used in main.ts for the OpenAPI dump.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml') as {
  dump: (obj: unknown, options?: Record<string, unknown>) => string;
};

/**
 * Turns an AppSpec into the exact files the deploy agent writes to the host.
 *
 * This is a pure function of its input — no database, no clock, no filesystem —
 * so the same spec always renders byte-for-byte identically. The diff shown
 * before a deploy (§9.2) depends on that property.
 */

export interface RenderInput {
  slug: string;
  tier: ApplicationTier;
  /**
   * COMPOSE makes the renderer emit a `build:` section and tag the result
   * locally; REGISTRY and NONE expect a ready image (D6).
   */
  buildMode?: BuildMode;
  /** Stamped into a label so a running container can be traced to its release. */
  releaseId: string;
  image?: string | null;
  version?: string | null;
  digest?: string | null;
  spec: unknown;
  /**
   * Fully interpolated environment. Values are written to the env file only —
   * the compose file references them and never contains a secret (I3, §9.4.2).
   */
  env: Record<string, string>;
}

export interface RenderOutput {
  compose: string;
  env: string;
  /** The single service the renderer emits. */
  serviceName: string;
  /** Sorted env keys, for Release.renderedEnvKeys. */
  envKeys: string[];
}

/**
 * Fixed service name. Containers are identified by the homelab.* labels, not by
 * name, so there is nothing to gain from varying this and a stable name keeps
 * the health gate and the generated compose predictable.
 */
const SERVICE_NAME = 'app';

const LOG_ROTATION = {
  driver: 'json-file',
  options: { 'max-size': '10m', 'max-file': '3' },
} as const;

const HEALTHCHECK_TIMING = {
  interval: '30s',
  timeout: '5s',
  retries: 3,
  start_period: '30s',
} as const;

/** Traefik resource names allow a narrower alphabet than our slugs. */
const traefikName = (slug: string): string =>
  slug.replace(/[^A-Za-z0-9._-]/g, '-');

@Injectable()
export class ComposeRendererService {
  render(input: RenderInput): RenderOutput {
    const spec = parseAppSpec(input.spec);

    const compose = yaml.dump(this.buildCompose(input, spec), {
      lineWidth: -1,
      noRefs: true,
    });

    return {
      compose,
      env: this.buildEnvFile(input.env),
      serviceName: SERVICE_NAME,
      envKeys: Object.keys(input.env).sort(),
    };
  }

  private buildCompose(
    input: RenderInput,
    spec: ReturnType<typeof parseAppSpec>,
  ): Record<string, unknown> {
    const service: Record<string, unknown> = {
      image: this.resolveImage(input, spec),
    };

    if (input.buildMode === BuildMode.COMPOSE) {
      service.build = this.buildSection(spec);
    }

    service.restart = 'unless-stopped';
    service.env_file = [spec.envFilePath];

    if (spec.publishPort !== undefined) {
      service.ports = [`${spec.publishPort}:${spec.port}`];
    }

    if (spec.volumes?.length) {
      service.volumes = spec.volumes.map(
        (volume) =>
          `${volume.host}:${volume.path}${volume.readOnly ? ':ro' : ''}`,
      );
    }

    const healthcheck = this.buildHealthcheck(spec);
    if (healthcheck) service.healthcheck = healthcheck;

    service.logging = LOG_ROTATION;

    const limits = this.buildResourceLimits(spec);
    if (limits) service.deploy = { resources: { limits } };

    service.labels = this.buildLabels(input, spec);
    service.networks = [spec.network];

    return {
      // Required at the top level by TrueNAS custom apps since 25.10 (§4.2).
      services: { [SERVICE_NAME]: service },
      networks: { [spec.network]: { external: true } },
    };
  }

  /**
   * D10 — a deployment is identified by a digest, falling back to an explicit
   * version. A floating tag would make the release irreproducible, so an
   * unpinned image is rejected rather than silently turned into `:latest`.
   */
  private resolveImage(
    input: RenderInput,
    spec: ReturnType<typeof parseAppSpec>,
  ): string {
    // With a build section the image reference is the tag the build is written
    // to, so there is no digest to pin yet — and pinning one would contradict
    // the build, since compose would then have two different things to name.
    if (input.buildMode === BuildMode.COMPOSE) {
      if (!spec.build) {
        throw new BadRequestException(
          'buildMode COMPOSE requires spec.build.context — there is nothing to build from.',
        );
      }

      const name = input.image?.trim() || input.slug;
      return `${name}:${input.version ?? 'latest'}`;
    }

    const image = input.image?.trim();
    if (!image) {
      throw new BadRequestException(
        'Application has no image configured; a RENDERED application needs one.',
      );
    }

    if (input.digest) return `${image}@${input.digest}`;
    if (input.version) return `${image}:${input.version}`;

    // An image reference that already carries its own tag or digest is fine.
    const lastSegment = image.slice(image.lastIndexOf('/') + 1);
    if (lastSegment.includes('@') || lastSegment.includes(':')) return image;

    throw new BadRequestException(
      `Image "${image}" is not pinned: provide a release version or digest, ` +
        'or include a tag in the image reference.',
    );
  }

  /**
   * Emitted only for buildMode COMPOSE. Build args are rendered as-is: they end
   * up baked into image metadata, so a secret must never travel this way — that
   * is what the env file is for.
   */
  private buildSection(
    spec: ReturnType<typeof parseAppSpec>,
  ): Record<string, unknown> {
    const build = spec.build;
    if (!build) {
      throw new BadRequestException('spec.build is required to build a stack.');
    }

    const section: Record<string, unknown> = { context: build.context };

    if (build.dockerfile) section.dockerfile = build.dockerfile;
    if (build.target) section.target = build.target;
    if (build.args && Object.keys(build.args).length) {
      // Stable key order keeps the render deterministic (§9.4.1).
      section.args = Object.fromEntries(
        Object.entries(build.args).sort(([a], [b]) => a.localeCompare(b)),
      );
    }

    return section;
  }

  private buildHealthcheck(
    spec: ReturnType<typeof parseAppSpec>,
  ): Record<string, unknown> | undefined {
    if (spec.healthCommand?.length) {
      return { test: ['CMD', ...spec.healthCommand], ...HEALTHCHECK_TIMING };
    }

    if (!spec.health || spec.port === undefined) return undefined;

    // busybox wget, present in the alpine images used across the homelab. Images
    // without it should set spec.healthCommand — a broken healthcheck fails the
    // deploy health gate (§12.5) on an otherwise healthy release.
    return {
      test: [
        'CMD-SHELL',
        `wget -q --spider http://127.0.0.1:${spec.port}${spec.health} || exit 1`,
      ],
      ...HEALTHCHECK_TIMING,
    };
  }

  private buildResourceLimits(
    spec: ReturnType<typeof parseAppSpec>,
  ): Record<string, string> | undefined {
    const limits: Record<string, string> = {};

    if (spec.resources?.memory) limits.memory = spec.resources.memory;
    if (spec.resources?.cpus) limits.cpus = spec.resources.cpus;

    return Object.keys(limits).length ? limits : undefined;
  }

  /**
   * Label values are always strings: compose accepts numbers but docker stores
   * labels as strings, and a numeric label would round-trip differently.
   */
  private buildLabels(
    input: RenderInput,
    spec: ReturnType<typeof parseAppSpec>,
  ): Record<string, string> {
    const labels: Record<string, string> = {
      // I: without homelab.app the container is invisible to status mapping.
      'homelab.app': input.slug,
      'homelab.tier': input.tier,
      'homelab.release': input.releaseId,
    };

    // Cross-stack dependencies cannot be expressed as compose depends_on, so
    // they travel as a label for the panel's ordering and dependency view.
    if (spec.depends?.length) {
      labels['homelab.depends'] = spec.depends.join(',');
    }

    if (spec.domain && spec.port !== undefined) {
      const router = traefikName(input.slug);

      labels['traefik.enable'] = 'true';
      labels[`traefik.http.routers.${router}.rule`] =
        `Host(\`${spec.domain}\`)`;
      labels[`traefik.http.routers.${router}.entrypoints`] = 'websecure';
      labels[`traefik.http.routers.${router}.tls.certresolver`] = 'letsencrypt';
      labels[`traefik.http.services.${router}.loadbalancer.server.port`] =
        String(spec.port);
    }

    return labels;
  }

  /**
   * Docker reads an env file line by line and takes the value literally to the
   * end of the line, so a newline in a value would silently truncate it and
   * turn the remainder into a bogus variable.
   */
  private buildEnvFile(env: Record<string, string>): string {
    const keys = Object.keys(env).sort();

    const lines = keys.map((key) => {
      assertEnvKey(key);

      const value = env[key];
      if (/[\r\n]/.test(value)) {
        throw new BadRequestException(
          `Environment value for "${key}" contains a line break, which docker ` +
            'cannot represent in an env file.',
        );
      }

      return `${key}=${value}`;
    });

    return lines.length ? `${lines.join('\n')}\n` : '';
  }
}

export type { AppSpec };
