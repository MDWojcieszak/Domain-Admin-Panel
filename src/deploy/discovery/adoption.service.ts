import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  AppSourceType,
  ApplicationTier,
  CategorySource,
  ContainerOrigin,
  Prisma,
  ReleaseStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AgentServerService } from '../agent/agent-server.service';
import { AuditService } from '../audit/audit.service';
import { DiscoveredStack, assertActionAllowed } from './container-classifier';
import { ContainerDiscoveryService } from './container-discovery.service';

/**
 * Brings an already-running compose stack under the panel's control (§8.4).
 *
 * Nothing on the host is touched: adoption only records what is already there,
 * taking the paths straight from the compose labels docker wrote. The stack
 * keeps running throughout.
 */

const slugify = (project: string): string =>
  project
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

@Injectable()
export class AdoptionService {
  private readonly logger = new Logger(AdoptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: ContainerDiscoveryService,
    private readonly audit: AuditService,
    private readonly servers: AgentServerService,
  ) {}

  async adopt(project: string, actorId?: string, serverId?: string) {
    const stack = this.discovery.stack(project);

    if (!assertActionAllowed(stack.origin, 'adopt')) {
      throw new BadRequestException(this.refusalReason(stack));
    }

    if (!stack.workingDir || stack.configFiles.length === 0) {
      throw new BadRequestException(
        `Stack "${project}" reports no compose working directory or config files, ` +
          'so there is nothing to adopt. It can still be viewed and restarted.',
      );
    }

    const slug = slugify(project);
    const existing = await this.prisma.application.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(
        `An application with slug "${slug}" already exists.`,
      );
    }

    const server = await this.servers.resolve(serverId);

    const application = await this.prisma.$transaction(async (tx) => {
      const category = await tx.serverCategory.create({
        data: {
          serverId: server.id,
          name: project,
          value: slug,
          source: CategorySource.MAIN,
        },
      });

      const created = await tx.application.create({
        data: {
          slug,
          displayName: project,
          description: `Adopted from the running compose stack "${project}".`,
          tier: ApplicationTier.APPLICATION,
          sourceType: AppSourceType.HOST,
          origin: ContainerOrigin.ADOPTABLE,
          image: stack.containers[0]?.image ?? null,
          serverCategoryId: category.id,
          runtimeStatus: stack.runtimeStatus,
          runtimeSince: new Date(),
          spec: this.specFromStack(stack) as Prisma.InputJsonValue,
        },
      });

      // Records what is running right now, so the panel has a baseline to roll
      // back to and a first entry in the release history.
      const release = await tx.release.create({
        data: {
          applicationId: created.id,
          status: ReleaseStatus.ACTIVE,
          digest: stack.containers[0]?.imageDigest ?? null,
          deployedAt: new Date(),
          renderedEnvKeys: [],
        },
      });

      return tx.application.update({
        where: { id: created.id },
        data: { currentReleaseId: release.id },
      });
    });

    await this.audit.record({
      actorId,
      action: 'application.adopt',
      entityType: 'Application',
      entityId: application.id,
      entityName: slug,
      diff: {
        project: { from: null, to: project },
        workingDir: { from: null, to: stack.workingDir },
      },
    });

    this.logger.log(`Adopted compose stack "${project}" as "${slug}"`);

    return application;
  }

  /**
   * I10 — the compose project name is pinned exactly as discovered. Renaming it
   * would make the next `up -d` build a second set of containers alongside the
   * running one instead of taking the existing stack over.
   */
  private specFromStack(stack: DiscoveredStack): Record<string, unknown> {
    return {
      projectName: stack.project,
      runDirectory: stack.workingDir,
      filePaths: stack.configFiles,
      envFilePath: '.env',
      autoPull: true,
      destroyBeforeDeploy: false,
      healthTimeout: 120,
      // Never for an adopted stack: its database migrations and data layout are
      // unknown to us, so an automatic rollback is a guess (§12.5).
      autoRollback: false,
      pollForUpdates: false,
      autoUpdate: false,
    };
  }

  private refusalReason(stack: DiscoveredStack): string {
    if (stack.origin === ContainerOrigin.MANAGED) {
      return `Stack "${stack.project}" is already managed by this panel.`;
    }
    if (stack.origin === ContainerOrigin.TRUENAS) {
      return (
        `Stack "${stack.project}" is a TrueNAS-managed application. TrueNAS ` +
        'reconciles it on its own, so adopting it would leave two owners. ' +
        'Remove it from the TrueNAS Apps UI first and recreate it here.'
      );
    }
    return (
      `Stack "${stack.project}" was not started by compose, so there is no ` +
      'compose file to adopt. Recreate it as a rendered application instead.'
    );
  }
}
