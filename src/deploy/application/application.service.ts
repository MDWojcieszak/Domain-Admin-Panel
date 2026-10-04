import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppSourceType,
  Application,
  BuildMode,
  ContainerOrigin,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeployRenderService } from '../renderer/deploy-render.service';
import { SecretCryptoService } from '../secrets/secret-crypto.service';
import {
  CreateApplicationDto,
  MoveToGitDto,
  UpdateApplicationDto,
  UpsertApplicationEnvDto,
} from '../dto';
import { APP_SPEC_DEFAULTS, assertEnvKey } from '../renderer/app-spec';
import {
  ComposeSourceService,
  ExtractedSecret,
  NormalisedCompose,
} from '../renderer/compose-source.service';
import {
  ApplicationDetailResponse,
  ApplicationResponse,
  ReleaseResponse,
} from '../responses';

/**
 * renderedCompose is deliberately left out: it is large and only needed for
 * one release's diff, which the render preview returns.
 */
const RELEASE_SELECT = {
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
  triggeredBy: { select: { id: true, email: true } },
} satisfies Prisma.ReleaseSelect;

/**
 * The only way an application leaves this module. Spelled out field by field
 * so a column added later — like the encrypted webhook secret — is not
 * returned by accident (I3).
 */
export const toApplicationResponse = (
  application: Application & { currentRelease: ReleaseResponse | null },
): ApplicationResponse => ({
  id: application.id,
  slug: application.slug,
  displayName: application.displayName,
  description: application.description,
  tier: application.tier,
  sourceType: application.sourceType,
  origin: application.origin,
  buildMode: application.buildMode,
  image: application.image,
  compose: application.compose,
  gitRepoId: application.gitRepoId,
  gitRef: application.gitRef,
  spec: (application.spec ?? {}) as Record<string, unknown>,
  runtimeStatus: application.runtimeStatus,
  runtimeSince: application.runtimeSince,
  runtimeMessage: application.runtimeMessage,
  availableDigest: application.availableDigest,
  lastPolledAt: application.lastPolledAt,
  webhookEnabled: application.webhookEnabled,
  hasWebhookSecret: application.webhookSecret !== null,
  currentRelease: application.currentRelease,
  createdAt: application.createdAt,
  updatedAt: application.updatedAt,
});

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
    private readonly composeSource: ComposeSourceService,
  ) {}

  async list(): Promise<ApplicationResponse[]> {
    const applications = await this.prisma.application.findMany({
      where: { isDeleted: false },
      orderBy: { slug: 'asc' },
      include: { currentRelease: { select: RELEASE_SELECT } },
    });

    return applications.map((application) =>
      toApplicationResponse(application),
    );
  }

  async get(id: string): Promise<ApplicationDetailResponse> {
    const application = await this.prisma.application.findFirst({
      where: { id, isDeleted: false },
      include: {
        currentRelease: { select: RELEASE_SELECT },
        gitRepo: { select: { id: true, name: true, repo: true, branch: true } },
        releases: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: RELEASE_SELECT,
        },
      },
    });

    if (!application) throw new NotFoundException('Application not found');

    return {
      ...toApplicationResponse(application),
      gitRepo: application.gitRepo,
      releases: application.releases,
    };
  }

  async create(
    dto: CreateApplicationDto,
    actorId?: string,
    canWriteSecrets = false,
  ) {
    // Reject a bad spec before anything is written, not at deploy time.
    this.render.validateSpec(dto.spec ?? {});

    const compose = this.prepareCompose(
      dto.sourceType === AppSourceType.COMPOSE,
      dto.compose,
      canWriteSecrets,
    );

    const existing = await this.prisma.application.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(
        `An application with slug "${dto.slug}" already exists.`,
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
        gitRef: dto.gitRef ?? null,
        spec: (dto.spec ?? {}) as Prisma.InputJsonValue,
        compose: compose?.compose ?? null,
        ...(compose ? { buildMode: compose.buildMode } : {}),
      },
    });

    if (compose) {
      await this.storeExtractedSecrets(application.id, compose.extracted);
    }

    await this.audit.record({
      actorId,
      action: 'application.create',
      entityType: 'Application',
      entityId: application.id,
      entityName: application.slug,
      diff: this.audit.buildDiff({}, { slug: application.slug }) ?? undefined,
    });

    return this.get(application.id);
  }

  async update(
    id: string,
    dto: UpdateApplicationDto,
    actorId?: string,
    canWriteSecrets = false,
  ) {
    const existing = await this.prisma.application.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Application not found');

    if (dto.spec !== undefined) this.render.validateSpec(dto.spec);

    // A git application takes one only while the panel keeps its file (the
    // repository supplies the code); otherwise the repository's file runs.
    const keepsFile =
      existing.sourceType === AppSourceType.COMPOSE ||
      (existing.sourceType === AppSourceType.GIT && existing.compose !== null);
    if (dto.compose !== undefined && !keepsFile) {
      throw new BadRequestException(
        'This application runs a compose file it does not keep in the panel.',
      );
    }
    const compose =
      dto.compose === undefined
        ? null
        : this.prepareCompose(
            true,
            dto.compose,
            canWriteSecrets,
            existing.sourceType === AppSourceType.GIT,
          );

    const application = await this.prisma.application.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        description: dto.description,
        tier: dto.tier,
        image: dto.image,
        gitRepoId: dto.gitRepoId,
        gitRef: dto.gitRef,
        buildMode: dto.buildMode,
        webhookEnabled: dto.webhookEnabled,
        spec:
          dto.spec === undefined
            ? undefined
            : (dto.spec as Prisma.InputJsonValue),
        ...(compose
          ? { compose: compose.compose, buildMode: compose.buildMode }
          : {}),
      },
    });

    if (compose) await this.storeExtractedSecrets(id, compose.extracted);

    const diff = this.audit.buildDiff(
      {
        displayName: existing.displayName,
        description: existing.description,
        tier: existing.tier,
        image: existing.image,
        gitRepoId: existing.gitRepoId,
        gitRef: existing.gitRef,
        buildMode: existing.buildMode,
        webhookEnabled: existing.webhookEnabled,
        spec: existing.spec,
        compose: existing.compose,
      },
      {
        displayName: application.displayName,
        description: application.description,
        tier: application.tier,
        image: application.image,
        gitRepoId: application.gitRepoId,
        gitRef: application.gitRef,
        buildMode: application.buildMode,
        webhookEnabled: application.webhookEnabled,
        spec: application.spec,
        compose: application.compose,
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

    return this.get(id);
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

  async listReleases(
    applicationId: string,
    take = 50,
  ): Promise<ReleaseResponse[]> {
    await this.get(applicationId);

    return this.prisma.release.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      take,
      select: RELEASE_SELECT,
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

  /**
   * Moves an application onto a git repository: from then on the repository's
   * own compose file runs from its clone, and every deployment fetches it.
   * Works from any source — adopted, own compose file or spec.
   *
   * The compose project name is pinned to what runs today (I10), so the next
   * deployment updates the running containers instead of starting a second
   * set beside them. The environment is kept as it is. Nothing is deployed
   * here; the next release goes through the usual preview and approval.
   */
  async moveToGit(id: string, dto: MoveToGitDto, actorId?: string) {
    const existing = await this.prisma.application.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Application not found');
    this.assertDeployable(existing.tier);

    const repo = await this.prisma.gitRepo.findUnique({
      where: { id: dto.gitRepoId },
      select: { id: true, name: true },
    });
    if (!repo) throw new NotFoundException('Git repository not found');

    // Off: the panel keeps the file it has and writes it into the clone; the
    // repository then supplies only the code it builds.
    const inRepository = dto.composeInRepository !== false;
    if (!inRepository && !existing.compose) {
      throw new BadRequestException(
        "There is no compose file kept in the panel to keep. Take the stack's " +
          "file over first, or use the repository's own.",
      );
    }

    const previous = (existing.spec ?? {}) as Record<string, unknown>;
    const spec = {
      ...previous,
      projectName:
        typeof previous.projectName === 'string'
          ? previous.projectName
          : existing.slug,
      runDirectory: dto.runDirectory ?? '.',
      filePaths: [dto.composeFile ?? 'compose.yaml'],
    };
    this.render.validateSpec(spec);

    await this.prisma.application.update({
      where: { id },
      data: {
        sourceType: AppSourceType.GIT,
        origin: ContainerOrigin.MANAGED,
        gitRepoId: repo.id,
        gitRef: dto.gitRef ?? null,
        buildMode: dto.buildMode ?? BuildMode.COMPOSE,
        // With the repository's own file, a stored copy would only drift from
        // it; kept, it is the file that runs.
        compose: inRepository ? null : existing.compose,
        spec: spec as Prisma.InputJsonValue,
      },
    });

    await this.audit.record({
      actorId,
      action: 'application.move-to-git',
      entityType: 'Application',
      entityId: id,
      entityName: existing.slug,
      diff: {
        sourceType: { from: existing.sourceType, to: AppSourceType.GIT },
        gitRepo: { from: existing.gitRepoId, to: repo.name },
        filePaths: { from: previous.filePaths ?? null, to: spec.filePaths },
        composeInRepository: { from: null, to: inRepository },
      },
    });

    return this.get(id);
  }

  /**
   * Validates and normalises an application's own compose file. Secrets typed
   * into it come out as encrypted env entries, which needs the permission to
   * write secrets — checked here because only now is it known whether there
   * are any.
   */
  private prepareCompose(
    required: boolean,
    text: string | undefined,
    canWriteSecrets: boolean,
    inClone = false,
  ): NormalisedCompose | null {
    if (!required) {
      if (text) {
        throw new BadRequestException(
          'A compose file is only accepted with sourceType COMPOSE.',
        );
      }
      return null;
    }
    if (!text?.trim()) {
      throw new BadRequestException(
        'An application of sourceType COMPOSE needs its compose file.',
      );
    }

    const normalised = this.composeSource.normalise(text, {
      envFilePath: APP_SPEC_DEFAULTS.envFilePath,
      inClone,
    });

    if (normalised.extracted.length && !canWriteSecrets) {
      throw new ForbiddenException(
        `The compose file contains secrets (${normalised.extracted
          .map((e) => e.key)
          .join(', ')}); moving them into encrypted entries needs the ` +
          '"deploy.secrets" permission. Reference them as ${KEY} instead.',
      );
    }

    return normalised;
  }

  /** Values moved out of a compose file, stored the way typed-in secrets are. */
  async storeExtractedSecrets(
    applicationId: string,
    extracted: ExtractedSecret[],
  ): Promise<void> {
    for (const { key, value } of extracted) {
      const encrypted = this.crypto.encrypt(value);
      await this.prisma.applicationEnv.upsert({
        where: { applicationId_key: { applicationId, key } },
        create: { applicationId, key, value: encrypted, isSecret: true },
        update: { value: encrypted, isSecret: true },
      });
    }
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
