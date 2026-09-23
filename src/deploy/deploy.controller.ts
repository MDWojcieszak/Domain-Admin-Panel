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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { PERMISSIONS } from '../common/acl/permissions';
import { PermissionsService } from '../common/acl/permissions.service';
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { AgentHealthService } from './agent/agent-health.service';
import { DeployAgentGateway } from './agent/deploy-agent.gateway';
import { ApplicationImportService } from './application/application-import.service';
import { ApplicationService } from './application/application.service';
import { GitAccountService } from './git/git-account.service';
import { GitRepoService } from './git/git-repo.service';
import { AuditService } from './audit/audit.service';
import { AdoptionService } from './discovery/adoption.service';
import { ContainerDiscoveryService } from './discovery/container-discovery.service';
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
} from './dto';

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
  ) {}

  // — applications —

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('applications')
  listApplications() {
    return this.applications.list();
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('applications')
  createApplication(
    @Body() dto: CreateApplicationDto,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.applications.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('applications/:id')
  getApplication(@Param('id') id: string) {
    return this.applications.get(id);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Patch('applications/:id')
  updateApplication(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.applications.update(id, dto, userId);
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
  renderApplication(@Param('id') id: string) {
    return this.render.preview(id);
  }

  // — releases —

  /**
   * Starts a deployment. `composeHash` must match what the preview returned,
   * so a spec edited between preview and approval cannot slip through (I5).
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_EXECUTE)
  @Post('applications/:id/releases')
  createRelease(
    @Param('id') id: string,
    @Body() dto: CreateReleaseDto,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.releases.create(id, dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('applications/:id/releases')
  listReleases(@Param('id') id: string) {
    return this.applications.listReleases(id);
  }

  /** Redeploys a previous release from its stored bytes, not from the spec. */
  @RequirePermissions(PERMISSIONS.DEPLOY_EXECUTE)
  @Post('releases/:id/rollback')
  rollback(@Param('id') id: string, @GetCurrentUser('sub') userId: string) {
    return this.releases.rollback(id, userId);
  }

  /**
   * Issues a new CI webhook secret and returns it **once** — it is stored
   * encrypted, so a lost secret is rotated rather than recovered.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_SECRETS)
  @Post('applications/:id/webhook/rotate')
  async rotateWebhookSecret(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ) {
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
  previewImport(@Param('id') id: string) {
    return this.imports.preview(id);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('applications/:id/import')
  applyImport(@Param('id') id: string, @GetCurrentUser('sub') userId: string) {
    return this.imports.apply(id, userId);
  }

  // — git accounts and repositories —

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Get('git/accounts')
  listGitAccounts() {
    return this.gitAccounts.list();
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Post('git/accounts')
  createGitAccount(
    @Body() dto: UpsertGitAccountDto,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.gitAccounts.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Patch('git/accounts/:id')
  updateGitAccount(
    @Param('id') id: string,
    @Body() dto: UpsertGitAccountDto,
    @GetCurrentUser('sub') userId: string,
  ) {
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
  listGitRepos() {
    return this.gitRepos.list();
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Get('git/repos/:id')
  getGitRepo(@Param('id') id: string) {
    return this.gitRepos.get(id);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Post('git/repos')
  createGitRepo(
    @Body() dto: UpsertGitRepoDto,
    @GetCurrentUser('sub') userId: string,
  ) {
    return this.gitRepos.create(dto, userId);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_GIT)
  @Patch('git/repos/:id')
  updateGitRepo(
    @Param('id') id: string,
    @Body() dto: UpsertGitRepoDto,
    @GetCurrentUser('sub') userId: string,
  ) {
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
  listEnv(@Param('id') id: string) {
    return this.applications.listEnv(id);
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Put('applications/:id/env/:key')
  async upsertEnv(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() dto: UpsertApplicationEnvDto,
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('role') role: Role,
  ) {
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
  listVariables() {
    return this.variables.list();
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_SECRETS)
  @Put('variables')
  upsertVariable(
    @Body() dto: UpsertVariableDto,
    @GetCurrentUser('sub') userId: string,
  ) {
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
  listContainers() {
    return {
      ...this.discovery.snapshot(),
      agent: this.agentHealth.health(),
    };
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('containers/:project')
  getContainerStack(@Param('project') project: string) {
    return this.discovery.stack(project);
  }

  /** Brings a running compose stack under the panel's control (§8.4). */
  @RequirePermissions(PERMISSIONS.DEPLOY_MANAGE)
  @Post('containers/:project/adopt')
  adoptStack(
    @Param('project') project: string,
    @GetCurrentUser('sub') userId: string,
    @Query('serverId') serverId?: string,
  ) {
    return this.adoption.adopt(project, userId, serverId);
  }

  /**
   * Lifecycle action on any stack the agent reports. What is permitted depends
   * on the stack's origin (I11) — a TrueNAS-managed app accepts a restart but
   * never a stop, because its own reconciler owns that decision.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_EXECUTE)
  @Post('containers/:project/actions/:action')
  async runStackAction(
    @Param('project') project: string,
    @Param('action') action: string,
    @GetCurrentUser('sub') userId: string,
    @Query('serverId') serverId?: string,
  ) {
    if (!['start', 'restart', 'stop'].includes(action)) {
      throw new BadRequestException(
        `Unknown action "${action}". Expected start, restart or stop.`,
      );
    }

    const stack = this.discovery.stack(project);
    const result = await this.agent.runStackAction(
      stack,
      action as 'start' | 'restart' | 'stop',
      serverId,
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

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('containers/:project/logs')
  stackLogs(
    @Param('project') project: string,
    @Query('tail') tail?: string,
    @Query('serverId') serverId?: string,
  ) {
    const parsed = Number(tail);
    const lines =
      Number.isInteger(parsed) && parsed > 0 && parsed <= 5000 ? parsed : 200;

    return this.agent.fetchLogs(this.discovery.stack(project), lines, serverId);
  }

  /**
   * Forces the agent to republish its container list. The reply arrives as a
   * normal snapshot message, so this returns as soon as the request is sent.
   */
  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Post('containers/refresh')
  async refreshContainers(@Query('serverId') serverId?: string) {
    await this.agent.requestSnapshot('panel refresh', serverId);

    return { requested: true };
  }

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('agent')
  agentStatus() {
    return this.agentHealth.health();
  }

  // — audit trail —

  @RequirePermissions(PERMISSIONS.DEPLOY_READ)
  @Get('audit/:entityType/:entityId')
  listAudit(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('take') take?: string,
  ) {
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
    if (role === Role.OWNER) return;

    const permissions = await this.permissions.getEffectivePermissions(userId);

    if (!permissions.has(PERMISSIONS.DEPLOY_SECRETS)) {
      throw new ForbiddenException(
        `Writing a secret value requires the "${PERMISSIONS.DEPLOY_SECRETS}" permission.`,
      );
    }
  }
}
