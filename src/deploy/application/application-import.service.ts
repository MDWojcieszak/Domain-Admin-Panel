import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppSourceType, ContainerOrigin, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { DeployAgentGateway } from '../agent/deploy-agent.gateway';
import { AuditService } from '../audit/audit.service';
import { ApplicationService } from './application.service';
import { ContainerDiscoveryService } from '../discovery/container-discovery.service';
import {
  ComposeImporterService,
  ImportResult,
} from '../renderer/compose-importer.service';
import { APP_SPEC_DEFAULTS } from '../renderer/app-spec';
import {
  ComposeSourceService,
  NormalisedCompose,
} from '../renderer/compose-source.service';
import { DeployRenderService } from '../renderer/deploy-render.service';
import { redactSecrets } from '../secrets/log-redaction.service';

/**
 * Converts an adopted stack (`sourceType: HOST`) into a rendered one (§8.5).
 *
 * Two steps on purpose. The preview shows exactly what would be kept, what
 * would be lost, and which secrets have to be re-entered; only then does the
 * apply step write anything. Converting in one shot would make silent loss —
 * the real risk here — invisible until the next deployment.
 */

export interface ComposeTakeoverPreview {
  /** The file as it would be stored. */
  compose: string;
  /** The file on the host, secret values masked. */
  currentCompose: string;
  movedSecrets: string[];
  /** Read by the file but defined nowhere — fill them in before deploying. */
  variablesToFill: string[];
  notes: string[];
  workingDir: string | null;
  projectName: string;
}

export interface ImportPreview extends ImportResult {
  /** The compose that is on disk right now. */
  currentCompose: string;
  /** Keys whose values must be supplied before this application can deploy. */
  secretKeysToFill: string[];
  /** False when the warnings describe losses that make conversion a bad idea. */
  recommended: boolean;
}

@Injectable()
export class ApplicationImportService {
  private readonly logger = new Logger(ApplicationImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: ContainerDiscoveryService,
    private readonly agent: DeployAgentGateway,
    private readonly importer: ComposeImporterService,
    private readonly render: DeployRenderService,
    private readonly audit: AuditService,
    private readonly composeSource: ComposeSourceService,
    private readonly applications: ApplicationService,
  ) {}

  /**
   * The preview for the panel. The compose on disk may carry passwords inline,
   * so every secret-looking value is cut out of everything returned (I3) —
   * including the imported spec, where a healthcheck may repeat one.
   */
  async preview(applicationId: string): Promise<ImportPreview> {
    const preview = await this.inspect(applicationId);
    const secrets = this.importer.secretValues(preview.currentCompose);
    if (!secrets.length) return preview;

    // Matched in their JSON-escaped form too: a value with a quote or a
    // backslash is spelled differently inside the serialised preview.
    const forms = secrets.flatMap((v) => [v, JSON.stringify(v).slice(1, -1)]);
    const masked = JSON.parse(
      redactSecrets(JSON.stringify(preview), forms),
    ) as ImportPreview;

    if (JSON.stringify(masked.spec) !== JSON.stringify(preview.spec)) {
      masked.warnings.push(
        'The imported spec repeats a secret value (usually in the healthcheck). ' +
          'The spec is written to compose.yaml in plain text — replace it with ' +
          'a reference to the container environment, e.g. $$REDIS_PASSWORD, ' +
          'before deploying.',
      );
      masked.recommended = false;
    }

    return masked;
  }

  private async inspect(applicationId: string): Promise<ImportPreview> {
    const application = await this.load(applicationId);
    const { currentCompose, stack } = await this.readHostCompose(application);
    const result = this.importer.import(currentCompose, stack.project);

    const secretKeysToFill = result.env
      .filter((entry) => entry.isSecret)
      .map((entry) => entry.key);

    return {
      ...result,
      currentCompose,
      secretKeysToFill,
      // Anything flagged as a loss is a reason to keep the stack as HOST.
      recommended: !result.warnings.some((w) =>
        /LOST|DROPS|not a host path/.test(w),
      ),
    };
  }

  /**
   * Writes the imported spec and flips the application to RENDERED.
   *
   * Nothing is deployed here: the next deployment goes through the normal
   * preview-and-approve gate (I5), where the operator sees the diff between
   * what runs today and what the renderer would produce.
   */
  async apply(applicationId: string, actorId?: string) {
    const application = await this.load(applicationId);
    const preview = await this.inspect(applicationId);

    const spec = {
      ...(application.spec as Prisma.JsonObject),
      ...preview.spec,
      // I10 — the compose project name survives conversion untouched, or the
      // next `up -d` builds a second set of containers beside the running one.
      projectName: this.projectOf(application),
    };

    this.render.validateSpec(spec);

    const serialised = JSON.stringify(spec);
    if (
      this.importer
        .secretValues(preview.currentCompose)
        .some((value) => serialised.includes(value))
    ) {
      throw new BadRequestException(
        'The imported spec repeats a secret value (usually in the healthcheck), ' +
          'and the spec is written to compose.yaml in plain text. Change the ' +
          'stack on the host to reference the container environment instead, ' +
          'e.g. $$REDIS_PASSWORD, then convert.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const entry of preview.env) {
        await tx.applicationEnv.upsert({
          where: { applicationId_key: { applicationId, key: entry.key } },
          create: {
            applicationId,
            key: entry.key,
            // A secret keeps an empty value: importing it would move it into
            // the database through a path that never passes encryption (§8.5).
            value: entry.value ?? '',
            isSecret: entry.isSecret,
          },
          update: {},
        });
      }

      return tx.application.update({
        where: { id: applicationId },
        data: {
          sourceType: AppSourceType.RENDERED,
          origin: ContainerOrigin.MANAGED,
          image: preview.image ?? application.image,
          // AppSpec is JSON-shaped by construction, but TypeScript cannot see
          // that through the nested interfaces.
          spec: spec as unknown as Prisma.InputJsonValue,
        },
      });
    });

    await this.audit.record({
      actorId,
      action: 'application.import',
      entityType: 'Application',
      entityId: applicationId,
      entityName: application.slug,
      diff: {
        sourceType: { from: AppSourceType.HOST, to: AppSourceType.RENDERED },
        warnings: { from: null, to: preview.warnings.length },
      },
    });

    this.logger.log(
      `Converted "${application.slug}" from HOST to RENDERED ` +
        `(${preview.warnings.length} warning(s), ${preview.secretKeysToFill.length} secret(s) to fill)`,
    );

    return {
      application: updated,
      secretKeysToFill: preview.secretKeysToFill,
      warnings: preview.warnings,
    };
  }

  /**
   * The stack's compose file as it is on the host, through the agent. A stack
   * merged from several files is refused: taking only the first would quietly
   * drop the overrides.
   */
  private async readHostCompose(application: { slug: string; spec: unknown }) {
    const stack = this.discovery.stack(this.projectOf(application));

    const { files } = await this.agent.readStackFiles(stack);
    if (!files.length) {
      throw new BadRequestException(
        'The agent returned no compose files for this stack.',
      );
    }
    if (files.length > 1) {
      throw new BadRequestException(
        `This stack is composed of ${files.length} files (${files
          .map((f) => f.path)
          .join(', ')}). Merge them into one before taking it over, ` +
          'otherwise the overrides would be lost.',
      );
    }

    return { currentCompose: files[0].content, stack };
  }

  // — taking the compose file over as it is —

  /**
   * Taking over keeps the stack's own compose file instead of translating it
   * into a spec, so nothing is lost. What changes is shown here: inline
   * secrets move into encrypted entries, relative paths become absolute
   * (the file moves into the homelab repository), and every variable the file
   * reads without a value in the panel is listed. Writes nothing.
   */
  async previewTakeover(
    applicationId: string,
    pasted?: string,
  ): Promise<ComposeTakeoverPreview> {
    const application = await this.load(applicationId);
    const { currentCompose, workingDir } = await this.takeoverSource(
      application,
      pasted,
    );
    const normalised = this.normaliseHost(currentCompose, workingDir);
    const secrets = normalised.extracted.map((e) => e.value);

    return {
      compose: normalised.compose,
      // The file on disk still holds the secrets; the panel never does (I3).
      currentCompose: redactSecrets(currentCompose, [
        ...secrets,
        ...this.importer.secretValues(currentCompose),
      ]),
      movedSecrets: normalised.extracted.map((e) => e.key),
      variablesToFill: this.variablesToFill(normalised),
      notes: normalised.notes,
      workingDir,
      projectName: this.projectOf(application),
    };
  }

  async applyTakeover(
    applicationId: string,
    actorId?: string,
    canWriteSecrets = false,
    pasted?: string,
  ) {
    const application = await this.load(applicationId);
    const { currentCompose, workingDir } = await this.takeoverSource(
      application,
      pasted,
    );
    const normalised = this.normaliseHost(currentCompose, workingDir);

    if (normalised.extracted.length && !canWriteSecrets) {
      throw new ForbiddenException(
        'The compose file contains inline secrets; moving them into encrypted ' +
          'entries needs the "deploy.secrets" permission.',
      );
    }

    const spec = {
      ...(application.spec as Prisma.JsonObject),
      // I10 — the compose project name survives the takeover untouched, or the
      // next `up -d` builds a second set of containers beside the running one.
      projectName: this.projectOf(application),
    };
    this.render.validateSpec(spec);

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        sourceType: AppSourceType.COMPOSE,
        origin: ContainerOrigin.MANAGED,
        compose: normalised.compose,
        buildMode: normalised.buildMode,
        spec: spec as Prisma.InputJsonValue,
      },
    });
    await this.applications.storeExtractedSecrets(
      applicationId,
      normalised.extracted,
    );

    await this.audit.record({
      actorId,
      action: 'application.takeover',
      entityType: 'Application',
      entityId: applicationId,
      entityName: application.slug,
      diff: {
        sourceType: { from: AppSourceType.HOST, to: AppSourceType.COMPOSE },
        workingDir: { from: workingDir, to: null },
        movedSecrets: {
          from: null,
          to: normalised.extracted.map((e) => e.key).join(', ') || null,
        },
      },
    });

    this.logger.log(
      `Took over the compose file of "${application.slug}" ` +
        `(${normalised.extracted.length} secret(s) moved)`,
    );
  }

  /**
   * The file to take over: read from the host through the agent, or pasted by
   * the operator — for a file the agent cannot see, or a stack merged from
   * several files. A pasted file is the operator's word for what runs; its
   * relative paths are still resolved against the directory the stack reports.
   */
  private async takeoverSource(
    application: { slug: string; spec: unknown },
    pasted?: string,
  ): Promise<{ currentCompose: string; workingDir: string | null }> {
    if (!pasted?.trim()) {
      const { currentCompose, stack } = await this.readHostCompose(application);
      return { currentCompose, workingDir: this.usableDir(stack.workingDir) };
    }

    let workingDir: string | null = null;
    try {
      workingDir = this.discovery.stack(this.projectOf(application)).workingDir;
    } catch {
      // Not running right now: relative paths will be refused rather than guessed.
    }

    return { currentCompose: pasted, workingDir: this.usableDir(workingDir) };
  }

  /**
   * Only a POSIX path can anchor relative paths for the host's daemon. A
   * Windows path (a stack started from Docker Desktop) cannot, so relative
   * paths are then refused with an explanation instead of mangled.
   */
  private usableDir(dir: string | null): string | null {
    return dir?.startsWith('/') ? dir : null;
  }

  private normaliseHost(compose: string, workingDir: string | null) {
    return this.composeSource.normalise(compose, {
      workingDir: workingDir ?? undefined,
      envFilePath: APP_SPEC_DEFAULTS.envFilePath,
    });
  }

  /** `${VAR}` the file reads with no default and no value from the takeover. */
  private variablesToFill(normalised: NormalisedCompose): string[] {
    const moved = new Set(normalised.extracted.map((e) => e.key));
    return this.composeSource
      .referencedVariables(normalised.compose)
      .filter((ref) => !ref.hasDefault && !moved.has(ref.key))
      .map((ref) => ref.key);
  }

  private async load(applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, isDeleted: false },
    });

    if (!application) throw new NotFoundException('Application not found');

    if (application.sourceType !== AppSourceType.HOST) {
      throw new BadRequestException(
        `Only HOST applications can be imported; "${application.slug}" is ` +
          `${application.sourceType}.`,
      );
    }

    return application;
  }

  private projectOf(application: { slug: string; spec: unknown }): string {
    const spec = (application.spec ?? {}) as Record<string, unknown>;

    return typeof spec.projectName === 'string'
      ? spec.projectName
      : application.slug;
  }
}
