import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { PERMISSIONS } from '../common/acl/permissions';
import { PermissionsService } from '../common/acl/permissions.service';
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { AgentHealthService } from './agent/agent-health.service';
import { DeployAgentGateway } from './agent/deploy-agent.gateway';
import { ApplicationImportService } from './application/application-import.service';
import { ApplicationService } from './application/application.service';
import { GitAccountService } from './git/git-account.service';
import { GitRefsService } from './git/git-refs.service';
import { GitRepoService } from './git/git-repo.service';
import { AuditService } from './audit/audit.service';
import { AdoptionService } from './discovery/adoption.service';
import { ContainerDiscoveryService } from './discovery/container-discovery.service';
import { APP_SPEC_DEFAULTS } from './renderer/app-spec';
import { ComposeSourceService } from './renderer/compose-source.service';
import { DeployRenderService } from './renderer/deploy-render.service';
import { VariableService } from './variable/variable.service';
import { ReleaseService } from './release/release.service';
import { DeployWebhookService } from './webhook/deploy-webhook.service';
import { WEBHOOK_SECRET_HEADER } from './webhook/deploy-webhook.controller';
import {
  CreateApplicationDto,
  CreateReleaseDto,
  UpdateApplicationDto,
  UpsertApplicationEnvDto,
  UpsertGitAccountDto,
  UpsertGitRepoDto,
  UpsertVariableDto,
  CheckComposeDto,
  MoveToGitDto,
  TakeoverComposeDto,
} from './dto';
import {
  AgentHealthResponse,
  ApplicationDetailResponse,
  ApplicationEnvResponse,
  ApplicationResponse,
  AuditEntryResponse,
  ContainerOverviewResponse,
  DiscoveredStackResponse,
  GitAccountResponse,
  GitRepoResponse,
  ImportPreviewResponse,
  RefreshRequestedResponse,
  ReleaseResponse,
  ReleaseStartedResponse,
  RenderPreviewResponse,
  StackActionResponse,
  StackLogsResponse,
  VariableResponse,
  WebhookSecretResponse,
  ComposeCheckResponse,
  ComposeTakeoverPreviewResponse,
  GitRefsResponse,
} from './responses';

@ApiTags('Deploy')
@ApiBearerAuth()
@Controller('deploy')
export class DeployController {
  constructor(
    private readonly applications: ApplicationService,
    private readonly variables: VariableService,
    private readonly render: DeployRenderService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
    private readonly discovery: ContainerDiscoveryService,
    private readonly adoption: AdoptionService,
    private readonly agentHealth: AgentHealthService,
    private readonly agent: DeployAgentGateway,
    private readonly releases: ReleaseService,
    private readonly webhooks: DeployWebhookService,
    private readonly imports: ApplicationImportService,
    private readonly gitAccounts: GitAccountService,
    private readonly gitRepos: GitRepoService,
    private readonly composeSource: ComposeSourceService,
    private readonly gitRefs: GitRefsService,
  ) {}

  // — applications —

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('applications')
  @ApiOkResponse({ type: ApplicationResponse, isArray: true })
  listApplications(): Promise<ApplicationResponse[]> {
    return this.applications.list();
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('applications')
  @ApiOkResponse({ type: ApplicationDetailResponse })
  async createApplication(
    @Body() dto: CreateApplicationDto,
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('role') role: Role,
  ): Promise<ApplicationDetailResponse> {
    return this.applications.create(
      dto,
      userId,
      await this.canWriteSecrets(userId, role),
    );
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('applications/:id')
  @ApiOkResponse({ type: ApplicationDetailResponse })
  getApplication(@Param('id') id: string): Promise<ApplicationDetailResponse> {
    return this.applications.get(id);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Patch('applications/:id')
  @ApiOkResponse({ type: ApplicationDetailResponse })
  async updateApplication(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('role') role: Role,
  ): Promise<ApplicationDetailResponse> {
    return this.applications.update(
      id,
      dto,
      userId,
      await this.canWriteSecrets(userId, role),
    );
  }

  /**
   * Dry run of saving a compose file: what would be stored, which inline
   * secrets would move into encrypted entries, which variables it reads.
   * Writes nothing and returns no secret value.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('compose/check')
  @ApiOkResponse({ type: ComposeCheckResponse })
  checkCompose(@Body() dto: CheckComposeDto): ComposeCheckResponse {
    const normalised = this.composeSource.normalise(dto.compose, {
      envFilePath: APP_SPEC_DEFAULTS.envFilePath,
      inClone: dto.inClone === true,
    });

    return {
      compose: normalised.compose,
      movedSecrets: normalised.extracted.map((e) => e.key),
      notes: normalised.notes,
      buildMode: normalised.buildMode,
      variables: this.composeSource.referencedVariables(normalised.compose),
    };
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Delete('applications/:id')
  deleteApplication(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.applications.remove(id, userId);
  }

  /**
   * Renders the application without touching the host, returning the compose
   * file, its hash and the currently deployed one for the panel's diff view.
   * This is the approval gate a deploy will later have to echo back (§9.2, I5).
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Post('applications/:id/render')
  @ApiOkResponse({ type: RenderPreviewResponse })
  renderApplication(@Param('id') id: string): Promise<RenderPreviewResponse> {
    return this.render.preview(id);
  }

  // — releases —

  /**
   * Starts a deployment. `composeHash` must match what the preview returned,
   * so a spec edited between preview and approval cannot slip through (I5).
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_EXECUTE)
  @Post('applications/:id/releases')
  @ApiOkResponse({ type: ReleaseStartedResponse })
  createRelease(
    @Param('id') id: string,
    @Body() dto: CreateReleaseDto,
    @GetCurrentUser('sub') userId: string,
  ): Promise<ReleaseStartedResponse> {
    return this.releases.create(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('applications/:id/releases')
  @ApiOkResponse({ type: ReleaseResponse, isArray: true })
  listReleases(@Param('id') id: string): Promise<ReleaseResponse[]> {
    return this.applications.listReleases(id);
  }

  /** Redeploys a previous release from its stored bytes, not from the spec. */
  @RequirePermissions(PERMISSIONS.DEPLOY_EXECUTE)
  @Post('releases/:id/rollback')
  @ApiOkResponse({ type: ReleaseStartedResponse })
  rollback(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<ReleaseStartedResponse> {
    return this.releases.rollback(id, userId);
  }

  /**
   * Stops a release that has not finished — running, or stuck because it
   * never reached the agent. Frees the application for the next deployment.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_EXECUTE)
  @Post('releases/:id/cancel')
  async cancelRelease(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<void> {
    await this.releases.cancel(id, userId);
  }

  /**
   * Issues a new CI webhook secret and returns it **once** — it is stored
   * encrypted, so a lost secret is rotated rather than recovered.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_SECRETS)
  @Post('applications/:id/webhook/rotate')
  @ApiOkResponse({ type: WebhookSecretResponse })
  async rotateWebhookSecret(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<WebhookSecretResponse> {
    const secret = await this.webhooks.rotateSecret(id, userId);

    return {
      secret,
      header: WEBHOOK_SECRET_HEADER,
      note: 'Store this now — it cannot be shown again.',
    };
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_SECRETS)
  @Delete('applications/:id/webhook')
  disableWebhook(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.webhooks.disable(id, userId);
  }

  // — converting an adopted stack to a rendered one (§8.5) —

  /**
   * Shows what conversion would keep, what it would lose, and which secrets
   * have to be re-entered. Writes nothing.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('applications/:id/import/preview')
  @ApiOkResponse({ type: ImportPreviewResponse })
  previewImport(@Param('id') id: string): Promise<ImportPreviewResponse> {
    return this.imports.preview(id);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('applications/:id/import')
  @ApiOkResponse({ type: ApplicationDetailResponse })
  async applyImport(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<ApplicationDetailResponse> {
    await this.imports.apply(id, userId);

    return this.applications.get(id);
  }

  /**
   * Taking an adopted stack over with its own compose file, unchanged apart
   * from secrets and relative paths — the lossless alternative to converting
   * it into a spec. Preview writes nothing.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('applications/:id/takeover/preview')
  @ApiOkResponse({ type: ComposeTakeoverPreviewResponse })
  previewTakeover(
    @Param('id') id: string,
    @Body() dto: TakeoverComposeDto,
  ): Promise<ComposeTakeoverPreviewResponse> {
    return this.imports.previewTakeover(id, dto.compose);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('applications/:id/takeover')
  @ApiOkResponse({ type: ApplicationDetailResponse })
  async applyTakeover(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('role') role: Role,
    @Body() dto: TakeoverComposeDto,
  ): Promise<ApplicationDetailResponse> {
    await this.imports.applyTakeover(
      id,
      userId,
      await this.canWriteSecrets(userId, role),
      dto.compose,
    );

    return this.applications.get(id);
  }

  /**
   * Moves an application onto a git repository, from any source. Its own
   * compose file in the repository runs from the clone from then on.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('applications/:id/move-to-git')
  @ApiOkResponse({ type: ApplicationDetailResponse })
  moveToGit(
    @Param('id') id: string,
    @Body() dto: MoveToGitDto,
    @GetCurrentUser('sub') userId: string,
  ): Promise<ApplicationDetailResponse> {
    return this.applications.moveToGit(id, dto, userId);
  }

  /**
   * What the application's repository offers to build from: the head of the
   * tracked branch, recent commits, tags and branches. Read from GitHub with
   * the repository's account token, cached for a minute.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('applications/:id/git/refs')
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiOkResponse({ type: GitRefsResponse })
  listGitRefs(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('take') take?: string,
  ): Promise<GitRefsResponse> {
    return this.gitRefs.list(id, search, take ? Number(take) : undefined);
  }

  // — git accounts and repositories —

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Get('git/accounts')
  @ApiOkResponse({ type: GitAccountResponse, isArray: true })
  listGitAccounts(): Promise<GitAccountResponse[]> {
    return this.gitAccounts.list();
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Post('git/accounts')
  @ApiOkResponse({ type: GitAccountResponse })
  createGitAccount(
    @Body() dto: UpsertGitAccountDto,
    @GetCurrentUser('sub') userId: string,
  ): Promise<GitAccountResponse> {
    return this.gitAccounts.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Patch('git/accounts/:id')
  @ApiOkResponse({ type: GitAccountResponse })
  updateGitAccount(
    @Param('id') id: string,
    @Body() dto: UpsertGitAccountDto,
    @GetCurrentUser('sub') userId: string,
  ): Promise<GitAccountResponse> {
    return this.gitAccounts.update(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Delete('git/accounts/:id')
  deleteGitAccount(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.gitAccounts.remove(id, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Get('git/repos')
  @ApiOkResponse({ type: GitRepoResponse, isArray: true })
  listGitRepos(): Promise<GitRepoResponse[]> {
    return this.gitRepos.list();
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Get('git/repos/:id')
  @ApiOkResponse({ type: GitRepoResponse })
  getGitRepo(@Param('id') id: string): Promise<GitRepoResponse> {
    return this.gitRepos.get(id);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Post('git/repos')
  @ApiOkResponse({ type: GitRepoResponse })
  createGitRepo(
    @Body() dto: UpsertGitRepoDto,
    @GetCurrentUser('sub') userId: string,
  ): Promise<GitRepoResponse> {
    return this.gitRepos.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Patch('git/repos/:id')
  @ApiOkResponse({ type: GitRepoResponse })
  updateGitRepo(
    @Param('id') id: string,
    @Body() dto: UpsertGitRepoDto,
    @GetCurrentUser('sub') userId: string,
  ): Promise<GitRepoResponse> {
    return this.gitRepos.update(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Delete('git/repos/:id')
  deleteGitRepo(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.gitRepos.remove(id, userId);
  }

  // — application environment —

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Get('applications/:id/env')
  @ApiOkResponse({ type: ApplicationEnvResponse, isArray: true })
  listEnv(@Param('id') id: string): Promise<ApplicationEnvResponse[]> {
    return this.applications.listEnv(id);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Put('applications/:id/env/:key')
  @ApiOkResponse({ type: ApplicationEnvResponse })
  async upsertEnv(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() dto: UpsertApplicationEnvDto,
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('role') role: Role,
  ): Promise<ApplicationEnvResponse> {
    if (dto.isSecret) {
      await this.assertCanWriteSecrets(userId, role);
    }

    return this.applications.upsertEnv(id, key, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Delete('applications/:id/env/:key')
  deleteEnv(
    @Param('id') id: string,
    @Param('key') key: string,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.applications.removeEnv(id, key, userId);
  }

  // — global variables —

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('variables')
  @ApiOkResponse({ type: VariableResponse, isArray: true })
  listVariables(): Promise<VariableResponse[]> {
    return this.variables.list();
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_SECRETS)
  @Put('variables')
  @ApiOkResponse({ type: VariableResponse })
  upsertVariable(
    @Body() dto: UpsertVariableDto,
    @GetCurrentUser('sub') userId: string,
  ): Promise<VariableResponse> {
    return this.variables.upsert(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_SECRETS)
  @Delete('variables/:id')
  deleteVariable(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.variables.remove(id, userId);
  }

  // — containers on the host —

  /**
   * Every container the agent reports, grouped into stacks and classified
   * (§8.4) — including stacks this panel does not manage and TrueNAS's own
   * applications. `known: false` means the agent has not reported yet, which is
   * not the same as "nothing is running".
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('containers')
  @ApiOkResponse({ type: ContainerOverviewResponse })
  listContainers(): ContainerOverviewResponse {
    return {
      ...this.discovery.snapshot(),
      agent: this.agentHealth.health(),
    };
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('containers/:project')
  @ApiOkResponse({ type: DiscoveredStackResponse })
  getContainerStack(
    @Param('project') project: string,
  ): DiscoveredStackResponse {
    return this.discovery.stack(project);
  }

  /** Brings a running compose stack under the panel's control (§8.4). */
  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('containers/:project/adopt')
  @ApiOkResponse({ type: ApplicationDetailResponse })
  async adoptStack(
    @Param('project') project: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<ApplicationDetailResponse> {
    const application = await this.adoption.adopt(project, userId);

    return this.applications.get(application.id);
  }

  /**
   * Lifecycle action on any stack the agent reports. What is permitted depends
   * on the stack's origin (I11) — a TrueNAS-managed app accepts a restart but
   * never a stop, because its own reconciler owns that decision.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_EXECUTE)
  @Post('containers/:project/actions/:action')
  @ApiOkResponse({ type: StackActionResponse })
  async runStackAction(
    @Param('project') project: string,
    @Param('action') action: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<StackActionResponse> {
    if (!['start', 'restart', 'stop'].includes(action)) {
      throw new BadRequestException(
        `Unknown action "${action}". Expected start, restart or stop.`,
      );
    }

    const stack = this.discovery.stack(project);
    const result = await this.agent.runStackAction(
      stack,
      action as 'start' | 'restart' | 'stop',
    );

    await this.audit.record({
      actorId: userId,
      action: `stack.${action}`,
      entityType: 'ContainerStack',
      entityId: project,
      entityName: project,
      diff: { origin: { from: stack.origin, to: stack.origin } },
    });

    return result;
  }
  /** Lifecycle action on one container of a stack, by its docker id. */
  @RequirePermissions(PERMISSIONS.DEPLOY_EXECUTE)
  @Post('containers/:project/containers/:containerId/actions/:action')
  @ApiOkResponse({ type: StackActionResponse })
  async runContainerAction(
    @Param('project') project: string,
    @Param('containerId') containerId: string,
    @Param('action') action: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<StackActionResponse> {
    if (!['start', 'restart', 'stop'].includes(action)) {
      throw new BadRequestException(
        `Unknown action "${action}". Expected start, restart or stop.`,
      );
    }

    const stack = this.discovery.stack(project);
    const container = stack.containers.find((c) => c.id === containerId);
    const result = await this.agent.runStackAction(
      stack,
      action as 'start' | 'restart' | 'stop',
      containerId,
    );

    await this.audit.record({
      actorId: userId,
      action: `container.${action}`,
      entityType: 'ContainerStack',
      entityId: project,
      entityName: project,
      diff: { container: { from: null, to: container?.name ?? containerId } },
    });

    return result;
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('containers/:project/logs')
  @ApiOkResponse({ type: StackLogsResponse })
  @ApiQuery({ name: 'tail', required: false, type: Number })
  stackLogs(
    @Param('project') project: string,
    @Query('tail') tail?: string,
  ): Promise<StackLogsResponse> {
    const parsed = Number(tail);
    const lines =
      Number.isInteger(parsed) && parsed > 0 && parsed <= 5000 ? parsed : 200;

    return this.agent.fetchLogs(this.discovery.stack(project), lines);
  }

  /**
   * Forces the agent to republish its container list. The reply arrives as a
   * normal snapshot message, so this returns as soon as the request is sent.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Post('containers/refresh')
  @ApiOkResponse({ type: RefreshRequestedResponse })
  async refreshContainers(): Promise<RefreshRequestedResponse> {
    await this.agent.requestSnapshot('panel refresh');

    return { requested: true };
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('agent')
  @ApiOkResponse({ type: AgentHealthResponse })
  agentStatus(): AgentHealthResponse {
    return this.agentHealth.health();
  }

  // — audit trail —

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('audit/:entityType/:entityId')
  @ApiOkResponse({ type: AuditEntryResponse, isArray: true })
  @ApiQuery({ name: 'take', required: false, type: Number })
  listAudit(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('take') take?: string,
  ): Promise<AuditEntryResponse[]> {
    const parsed = Number(take);
    const limit =
      Number.isInteger(parsed) && parsed > 0 && parsed <= 200 ? parsed : 50;

    return this.audit.list(entityType, entityId, limit);
  }

  /**
   * Writing a secret needs deploy.secrets on top of deploy.manage. The guard
   * decorator cannot express a check that depends on the request body, so it is
   * done here — mirroring the guard's OWNER bypass.
   */
  private async assertCanWriteSecrets(
    userId: string,
    role: Role,
  ): Promise<void> {
    if (await this.canWriteSecrets(userId, role)) return;

    throw new ForbiddenException(
      `Writing a secret value requires the "${PERMISSIONS.DEPLOY_SECRETS}" permission.`,
    );
  }

  private async canWriteSecrets(userId: string, role: Role): Promise<boolean> {
    if (role === Role.OWNER) return true;

    const permissions = await this.permissions.getEffectivePermissions(userId);
    return permissions.has(PERMISSIONS.DEPLOY_SECRETS);
  }
}
