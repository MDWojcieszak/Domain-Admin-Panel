import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppSourceType, ApplicationTier, BuildMode } from '@prisma/client';
import { createHash } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import {
  InterpolationScope,
  InterpolationValue,
  InterpolatorService,
} from '../interpolation/interpolator.service';
import { maskEnvFile } from '../secrets/log-redaction.service';
import { SecretCryptoService } from '../secrets/secret-crypto.service';
import { ComposeRendererService } from './compose-renderer.service';
import { ComposeSourceService } from './compose-source.service';
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
    private readonly composeSource: ComposeSourceService,
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
    const { secretValues, secretKeys, ...preview } = await this.renderForDeploy(
      applicationId,
      releaseId,
    );

    // I3 — the panel sees which keys exist, never a secret's value: whole
    // values of secret keys and secrets interpolated into other values alike.
    return {
      ...preview,
      env:
        preview.env === null
          ? null
          : maskEnvFile(preview.env, secretKeys, secretValues),
    };
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
  ): Promise<
    RenderPreview & { secretValues: string[]; secretKeys: Set<string> }
  > {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, isDeleted: false },
      include: {
        envs: true,
        currentRelease: true,
        gitRepo: { select: { repo: true, branch: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.sourceType === AppSourceType.HOST) {
      throw new BadRequestException(
        `Application "${application.slug}" runs from a compose file on the host. ` +
          'Take the file over (or convert it to a spec) before deploying from the panel.',
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
      [
        ...Object.values(rawEnv),
        JSON.stringify(application.spec ?? {}),
        application.compose ?? '',
      ],
      scope,
    );

    // A compose file reads ${VAR} from the env file. One that nothing defines
    // would start the service with an empty value — an empty database password
    // is worse than a refused deployment (I6).
    if (application.compose) {
      for (const ref of this.composeSource.referencedVariables(
        application.compose ?? '',
      )) {
        if (!ref.hasDefault && !(ref.key in rawEnv)) missingKeys.push(ref.key);
      }
    }

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
        secretKeys: new Set<string>(),
      };
    }

    const env = this.interpolator.interpolateRecord(rawEnv, scope);
    const spec = this.interpolateSpec(application.spec, scope);

    // The application's own secrets are typed in, not interpolated, so the
    // interpolator never sees them as secret — without this they would be
    // missing from the log redaction and from the preview mask (I3).
    const secretKeys = new Set(
      application.envs.filter((e) => e.isSecret).map((e) => e.key),
    );
    const secretValues = [
      ...new Set([
        ...env.secretValues,
        ...[...secretKeys].map((key) => env.values[key]).filter(Boolean),
      ]),
    ];

    const rendered = this.renderSource(
      application,
      releaseId,
      spec,
      env.values,
      scope,
    );

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
      secretValues,
      secretKeys,
    };
  }

  /**
   * The compose file a deployment writes, by source:
   *
   * - RENDERED — produced from the spec.
   * - COMPOSE — the application's own file, with `[[KEY]]` resolved and the
   *   identifying labels added.
   * - GIT — the repository's own file runs, from the clone; what is written to
   *   the homelab repo is a record of what was deployed, so that releases still
   *   have something to diff, hash and approve.
   */
  private renderSource(
    application: {
      slug: string;
      tier: ApplicationTier;
      buildMode: BuildMode;
      sourceType: AppSourceType;
      image: string | null;
      compose: string | null;
      currentRelease: { version: string | null; digest: string | null } | null;
      gitRef: string | null;
      gitRepo: { repo: string; branch: string } | null;
    },
    releaseId: string,
    spec: unknown,
    env: Record<string, string>,
    scope: InterpolationScope,
  ): { compose: string; env: string; envKeys: string[] } {
    if (application.sourceType === AppSourceType.RENDERED) {
      return this.renderer.render({
        slug: application.slug,
        tier: application.tier,
        buildMode: application.buildMode,
        releaseId,
        image: application.image,
        version: application.currentRelease?.version ?? null,
        digest: application.currentRelease?.digest ?? null,
        spec: spec as never,
        env,
      });
    }

    const envFile = {
      env: this.renderer.buildEnvFile(env),
      envKeys: Object.keys(env).sort(),
    };

    // A file kept in the panel — its own application's, or one for a git
    // clone (the repository then supplies only the code).
    const keptFile =
      application.sourceType === AppSourceType.COMPOSE ||
      (application.sourceType === AppSourceType.GIT && application.compose);

    if (keptFile) {
      if (!application.compose) {
        throw new BadRequestException(
          `Application "${application.slug}" has no compose file yet.`,
        );
      }

      const resolved = this.interpolator.interpolate(
        application.compose,
        scope,
      );
      this.refuseSecrets(resolved.usedKeys, scope, 'the compose file');

      return {
        compose: this.composeSource.render(
          resolved.value,
          { slug: application.slug, tier: application.tier, releaseId },
          { inClone: application.sourceType === AppSourceType.GIT },
        ),
        ...envFile,
      };
    }

    // GIT
    if (!application.gitRepo) {
      throw new BadRequestException(
        `Application "${application.slug}" is GIT-sourced but has no repository.`,
      );
    }
    const files = parseAppSpec(spec).filePaths.join(', ');
    return {
      compose: [
        "# Deployed from git; the compose file is the repository's own.",
        `# repository: ${application.gitRepo.repo}@${
          application.gitRef ?? application.gitRepo.branch
        }`,
        `# files: ${files}`,
        `# env: ${envFile.envKeys.join(', ') || '(none)'}`,
        '',
      ].join('\n'),
      ...envFile,
    };
  }

  private refuseSecrets(
    usedKeys: string[],
    scope: InterpolationScope,
    where: string,
  ): void {
    const secretKeys = usedKeys.filter((key) => scope.get(key)?.isSecret);
    if (!secretKeys.length) return;

    throw new BadRequestException(
      `Secret variable(s) ${secretKeys.join(', ')} cannot be used in ${where}: ` +
        'it is stored with every release and committed to the homelab ' +
        "repository. Put the secret in the application's environment and read " +
        'it at runtime instead — ${KEY} in a compose file, or a healthCommand of ' +
        '["CMD-SHELL", "redis-cli -a $$REDIS_PASSWORD ping"] in a spec.',
    );
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

    // I3 — the spec becomes compose.yaml, which is stored with every release,
    // shown in the diff and committed to the homelab repository. A secret has
    // no business there; it belongs in the env file.
    this.refuseSecrets(resolved.usedKeys, scope, 'the spec');

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
