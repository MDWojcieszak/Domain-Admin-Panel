import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppSourceType } from '@prisma/client';
import { createHash } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import {
  InterpolationScope,
  InterpolationValue,
  InterpolatorService,
} from '../interpolation/interpolator.service';
import { SecretCryptoService } from '../secrets/secret-crypto.service';
import { ComposeRendererService } from './compose-renderer.service';
import { parseAppSpec } from './app-spec';

/**
 * Ties the pure renderer to the database: resolves an application's effective
 * environment, interpolates it and produces the files a deployment would write,
 * without touching the host.
 *
 * This is what backs the "preview before deploy" gate (§9.2): the panel shows
 * the rendered file and its diff against the running release, and the deploy
 * request must echo back `composeHash` so a spec edited between preview and
 * approval cannot slip through (I5).
 */

export interface RenderPreview {
  /** Null when `missingKeys` is non-empty: rendering cannot complete. */
  compose: string | null;
  /** sha256 of `compose`; echoed back on deploy to prove what was approved. */
  composeHash: string | null;
  env: string | null;
  envKeys: string[];
  /** Variables referenced but undefined — must be filled in before deploying (I6). */
  missingKeys: string[];
  /** Compose of the currently active release, for the panel's diff view. */
  previousCompose: string | null;
  changed: boolean;
}

const RELEASE_PREVIEW_ID = 'preview';

@Injectable()
export class DeployRenderService {
  private readonly logger = new Logger(DeployRenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: ComposeRendererService,
    private readonly interpolator: InterpolatorService,
    private readonly crypto: SecretCryptoService,
  ) {}

  /**
   * Effective interpolation scope, in the resolution order from §10.2:
   * application env entries shadow global variables.
   */
  async buildScope(applicationId: string): Promise<InterpolationScope> {
    const [variables, envs] = await Promise.all([
      this.prisma.variable.findMany(),
      this.prisma.applicationEnv.findMany({ where: { applicationId } }),
    ]);

    const scope = new Map<string, InterpolationValue>();

    for (const variable of variables) {
      scope.set(variable.key, {
        value: this.plaintext(variable.value, variable.isSecret, variable.key),
        isSecret: variable.isSecret,
      });
    }

    // Application-level entries win over globals.
    for (const env of envs) {
      scope.set(env.key, {
        value: this.plaintext(env.value, env.isSecret, env.key),
        isSecret: env.isSecret,
      });
    }

    return scope;
  }

  /**
   * Preview for the panel. Deliberately a thin wrapper that DROPS the resolved
   * secret values, so a controller cannot return them by accident (I3) — the
   * type it gets back simply has no field for them.
   */
  async preview(
    applicationId: string,
    releaseId = RELEASE_PREVIEW_ID,
  ): Promise<RenderPreview> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { secretValues, ...preview } = await this.renderForDeploy(
      applicationId,
      releaseId,
    );

    return preview;
  }

  /**
   * Full rendering, including the resolved secret values.
   *
   * Only the deployment path may call this: the values are needed to redact
   * them out of the agent's log stream (§10.4). They must never reach an HTTP
   * response.
   */
  async renderForDeploy(
    applicationId: string,
    releaseId = RELEASE_PREVIEW_ID,
  ): Promise<RenderPreview & { secretValues: string[] }> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, isDeleted: false },
      include: { envs: true, currentRelease: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.sourceType !== AppSourceType.RENDERED) {
      throw new BadRequestException(
        `Application "${application.slug}" has sourceType ${application.sourceType}; ` +
          'only RENDERED applications are produced by the renderer.',
      );
    }

    const scope = await this.buildScope(applicationId);
    const previousCompose = application.currentRelease?.renderedCompose ?? null;

    const rawEnv = Object.fromEntries(
      application.envs.map((env) => [
        env.key,
        this.plaintext(env.value, env.isSecret, env.key),
      ]),
    );

    // Report everything that is missing in one pass rather than failing on the
    // first undefined key — the panel shows the whole list to fill in.
    const missingKeys = this.interpolator.findMissingKeys(
      [...Object.values(rawEnv), JSON.stringify(application.spec ?? {})],
      scope,
    );

    if (missingKeys.length) {
      return {
        compose: null,
        composeHash: null,
        env: null,
        envKeys: Object.keys(rawEnv).sort(),
        missingKeys,
        previousCompose,
        changed: previousCompose !== null,
        secretValues: [],
      };
    }

    const env = this.interpolator.interpolateRecord(rawEnv, scope);
    const spec = this.interpolateSpec(application.spec, scope);

    const rendered = this.renderer.render({
      slug: application.slug,
      tier: application.tier,
      buildMode: application.buildMode,
      releaseId,
      image: application.image,
      version: application.currentRelease?.version ?? null,
      digest: application.currentRelease?.digest ?? null,
      spec,
      env: env.values,
    });

    return {
      compose: rendered.compose,
      composeHash: this.hash(rendered.compose),
      env: rendered.env,
      envKeys: rendered.envKeys,
      missingKeys: [],
      previousCompose,
      changed: rendered.compose !== previousCompose,
      // Resolved, not encrypted — only the deployment path receives these, and
      // only so the agent's log stream can be scrubbed of them (§10.4).
      secretValues: env.secretValues,
    };
  }

  /** Validates a spec without rendering — used when saving an application. */
  validateSpec(spec: unknown): void {
    parseAppSpec(spec);
  }

  hash(compose: string): string {
    return createHash('sha256').update(compose, 'utf8').digest('hex');
  }

  /**
   * Placeholders are allowed in the textual fields of a spec (a domain built
   * from `[[DOMAIN_SUFFIX]]`, a volume under `[[DATA_ROOT]]`). Round-tripping
   * through JSON keeps this generic instead of enumerating every field.
   */
  private interpolateSpec(spec: unknown, scope: InterpolationScope): unknown {
    if (spec === null || spec === undefined) return {};

    const resolved = this.interpolator.interpolate(JSON.stringify(spec), scope);

    try {
      return JSON.parse(resolved.value);
    } catch {
      throw new BadRequestException(
        'Interpolating the application spec produced invalid JSON; check for ' +
          'unescaped quotes in a referenced variable.',
      );
    }
  }

  /**
   * Values flagged as secret are stored encrypted. Tolerates a plaintext value
   * on a secret row — that happens with seeded or imported data — rather than
   * making the whole application unrenderable.
   */
  private plaintext(value: string, isSecret: boolean, key: string): string {
    if (!isSecret) return value;

    if (!this.crypto.isEncrypted(value)) {
      this.logger.warn(
        `Secret "${key}" is stored in plaintext; it will be encrypted on next write.`,
      );
      return value;
    }

    return this.crypto.decrypt(value);
  }
}
