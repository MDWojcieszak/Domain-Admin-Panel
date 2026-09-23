import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeployRenderService } from '../renderer/deploy-render.service';
import { SecretCryptoService } from '../secrets/secret-crypto.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  UpsertApplicationEnvDto,
} from '../dto';
import { assertEnvKey } from '../renderer/app-spec';

export interface ApplicationEnvView {
  key: string;
  isSecret: boolean;
  /** Present only for non-secret entries (§10.4). */
  value?: string;
  isSet: boolean;
}

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
    private readonly audit: AuditService,
    private readonly render: DeployRenderService,
  ) {}

  list() {
    return this.prisma.application.findMany({
      where: { isDeleted: false },
      orderBy: { slug: 'asc' },
      include: {
        currentRelease: {
          select: { id: true, version: true, digest: true, deployedAt: true },
        },
      },
    });
  }

  async get(id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, isDeleted: false },
      include: {
        currentRelease: true,
        gitRepo: { select: { id: true, name: true, repo: true, branch: true } },
        releases: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!application) throw new NotFoundException('Application not found');

    return application;
  }

  async create(dto: CreateApplicationDto, actorId?: string) {
    // Reject a bad spec before anything is written, not at deploy time.
    this.render.validateSpec(dto.spec ?? {});

    const category = await this.prisma.serverCategory.findUnique({
      where: { id: dto.serverCategoryId },
      include: { application: { select: { id: true } } },
    });

    if (!category) throw new NotFoundException('Server category not found');
    if (category.application) {
      throw new ConflictException(
        'This server category already backs another application.',
      );
    }

    const application = await this.prisma.application.create({
      data: {
        slug: dto.slug,
        displayName: dto.displayName ?? null,
        description: dto.description ?? null,
        tier: dto.tier,
        sourceType: dto.sourceType,
        image: dto.image ?? null,
        gitRepoId: dto.gitRepoId ?? null,
        serverCategoryId: dto.serverCategoryId,
        spec: (dto.spec ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.audit.record({
      actorId,
      action: 'application.create',
      entityType: 'Application',
      entityId: application.id,
      entityName: application.slug,
      diff: this.audit.buildDiff({}, { slug: application.slug }) ?? undefined,
    });

    return application;
  }

  async update(id: string, dto: UpdateApplicationDto, actorId?: string) {
    const existing = await this.prisma.application.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Application not found');

    if (dto.spec !== undefined) this.render.validateSpec(dto.spec);

    const application = await this.prisma.application.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        description: dto.description,
        tier: dto.tier,
        image: dto.image,
        gitRepoId: dto.gitRepoId,
        webhookEnabled: dto.webhookEnabled,
        spec:
          dto.spec === undefined
            ? undefined
            : (dto.spec as Prisma.InputJsonValue),
      },
    });

    const diff = this.audit.buildDiff(
      {
        displayName: existing.displayName,
        description: existing.description,
        tier: existing.tier,
        image: existing.image,
        gitRepoId: existing.gitRepoId,
        webhookEnabled: existing.webhookEnabled,
        spec: existing.spec,
      },
      {
        displayName: application.displayName,
        description: application.description,
        tier: application.tier,
        image: application.image,
        gitRepoId: application.gitRepoId,
        webhookEnabled: application.webhookEnabled,
        spec: application.spec,
      },
    );

    if (diff) {
      await this.audit.record({
        actorId,
        action: 'application.update',
        entityType: 'Application',
        entityId: id,
        entityName: application.slug,
        diff,
      });
    }

    return application;
  }

  async remove(id: string, actorId?: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, isDeleted: false },
    });
    if (!application) throw new NotFoundException('Application not found');

    // Soft delete: release history and audit trail stay readable (§13.2).
    await this.prisma.application.update({
      where: { id },
      data: { isDeleted: true },
    });

    await this.audit.record({
      actorId,
      action: 'application.delete',
      entityType: 'Application',
      entityId: id,
      entityName: application.slug,
    });
  }

  async listReleases(applicationId: string, take = 50) {
    await this.get(applicationId);

    return this.prisma.release.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        version: true,
        digest: true,
        commit: true,
        status: true,
        trigger: true,
        failureReason: true,
        homelabCommit: true,
        createdAt: true,
        deployedAt: true,
        processId: true,
        // renderedCompose is deliberately omitted: it is large and only needed
        // when showing one release's diff.
        triggeredBy: { select: { id: true, email: true } },
      },
    });
  }

  async listEnv(applicationId: string): Promise<ApplicationEnvView[]> {
    await this.get(applicationId);

    const envs = await this.prisma.applicationEnv.findMany({
      where: { applicationId },
      orderBy: { key: 'asc' },
    });

    return envs.map((env) => ({
      key: env.key,
      isSecret: env.isSecret,
      value: env.isSecret ? undefined : env.value,
      isSet: env.value.length > 0,
    }));
  }

  async upsertEnv(
    applicationId: string,
    key: string,
    dto: UpsertApplicationEnvDto,
    actorId?: string,
  ): Promise<ApplicationEnvView> {
    const application = await this.get(applicationId);
    assertEnvKey(key);

    const isSecret = dto.isSecret === true;
    const existing = await this.prisma.applicationEnv.findUnique({
      where: { applicationId_key: { applicationId, key } },
    });

    const value = isSecret ? this.crypto.encrypt(dto.value) : dto.value;

    const env = await this.prisma.applicationEnv.upsert({
      where: { applicationId_key: { applicationId, key } },
      create: { applicationId, key, value, isSecret },
      update: { value, isSecret },
    });

    await this.audit.record({
      actorId,
      action: existing ? 'application.env.update' : 'application.env.create',
      entityType: 'Application',
      entityId: applicationId,
      entityName: application.slug,
      diff: this.audit.buildDiff(
        existing ? { [key]: existing.value } : {},
        { [key]: env.value },
        isSecret || existing?.isSecret ? [key] : [],
      ),
    });

    return {
      key: env.key,
      isSecret: env.isSecret,
      value: env.isSecret ? undefined : env.value,
      isSet: env.value.length > 0,
    };
  }

  async removeEnv(
    applicationId: string,
    key: string,
    actorId?: string,
  ): Promise<void> {
    const application = await this.get(applicationId);

    const deleted = await this.prisma.applicationEnv.deleteMany({
      where: { applicationId, key },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(`Environment key "${key}" not found`);
    }

    await this.audit.record({
      actorId,
      action: 'application.env.delete',
      entityType: 'Application',
      entityId: applicationId,
      entityName: application.slug,
      diff: { [key]: { from: 'set', to: null } },
    });
  }

  /** Guards the deploy paths that phase 3 will add (I1). */
  assertDeployable(tier: string): void {
    if (tier === 'BOOTSTRAP') {
      throw new BadRequestException(
        'Bootstrap-tier applications cannot be deployed from the panel; ' +
          'they are updated through the agent self-update path.',
      );
    }
  }
}
