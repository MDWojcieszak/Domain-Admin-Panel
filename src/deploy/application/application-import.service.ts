import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppSourceType, ContainerOrigin, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { DeployAgentGateway } from '../agent/deploy-agent.gateway';
import { AuditService } from '../audit/audit.service';
import { ContainerDiscoveryService } from '../discovery/container-discovery.service';
import {
  ComposeImporterService,
  ImportResult,
} from '../renderer/compose-importer.service';
import { DeployRenderService } from '../renderer/deploy-render.service';

/**
 * Converts an adopted stack (`sourceType: HOST`) into a rendered one (§8.5).
 *
 * Two steps on purpose. The preview shows exactly what would be kept, what
 * would be lost, and which secrets have to be re-entered; only then does the
 * apply step write anything. Converting in one shot would make silent loss —
 * the real risk here — invisible until the next deployment.
 */

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
  ) {}

  async preview(applicationId: string): Promise<ImportPreview> {
    const application = await this.load(applicationId);
    const stack = this.discovery.stack(this.projectOf(application));

    const { files } = await this.agent.readStackFiles(stack);
    if (!files.length) {
      throw new BadRequestException(
        'The agent returned no compose files for this stack.',
      );
    }

    // Several compose files are merged by docker at run time; importing only
    // the first would quietly drop the overrides, so this is refused outright.
    if (files.length > 1) {
      throw new BadRequestException(
        `This stack is composed of ${files.length} files (${files
          .map((f) => f.path)
          .join(
            ', ',
          )}). Merge them into one before converting, otherwise the ` +
          'overrides would be lost.',
      );
    }

    const currentCompose = files[0].content;
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
    const preview = await this.preview(applicationId);

    const spec = {
      ...(application.spec as Prisma.JsonObject),
      ...preview.spec,
      // I10 — the compose project name survives conversion untouched, or the
      // next `up -d` builds a second set of containers beside the running one.
      projectName: this.projectOf(application),
    };

    this.render.validateSpec(spec);

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
