import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

import { Public } from '../common/decorators';
import {
  ProcessStatusDto,
  RegisterProcessDto,
  RegisterProcessLogDto,
} from '../server-process/dto';
import { ServerProcessService } from '../server-process/server-process.service';
import { AgentHealthService } from './agent/agent-health.service';
import { settle } from './agent/rmq-ack';
import { ContainerDiscoveryService } from './discovery/container-discovery.service';
import { GitAccountService } from './git/git-account.service';
import { GitRepoService } from './git/git-repo.service';
import { ReleaseService } from './release/release.service';
import { LogRedactionService } from './secrets/log-redaction.service';
import {
  AgentHeartbeatDto,
  ContainerChangedDto,
  ContainerSnapshotDto,
  DeployResultDto,
} from './dto';

/**
 * Inbound half of the deploy agent contract (docs/deploy-design.md §11).
 *
 * The agent reports raw docker facts; every derivation — stack grouping,
 * classification, runtime status — happens here. That keeps the agent small
 * enough to be trusted with a docker socket and means a rule change ships with
 * the backend rather than requiring an agent update.
 *
 * Everything on this controller arrives on the deployment queue, which uses
 * manual acknowledgement (§12.3), so each handler settles its own message.
 *
 * The `deploy.process.*` patterns mirror the Minecraft agent's `process.*` ones
 * and delegate to the same service. They exist separately so the deployment
 * path gets manual-ack semantics without changing the acknowledgement contract
 * of handlers that already work.
 */
@Controller()
export class DeployAgentController {
  private readonly logger = new Logger(DeployAgentController.name);

  constructor(
    private readonly discovery: ContainerDiscoveryService,
    private readonly agentHealth: AgentHealthService,
    private readonly processes: ServerProcessService,
    private readonly releases: ReleaseService,
    private readonly redaction: LogRedactionService,
    private readonly gitRepos: GitRepoService,
    private readonly gitAccounts: GitAccountService,
  ) {}

  // — container view —

  /** Full container list; replaces the backend's view. */
  @Public()
  @MessagePattern('containers.snapshot')
  async snapshot(
    @Payload() dto: ContainerSnapshotDto,
    @Ctx() context: RmqContext,
  ) {
    return settle(context, async () => {
      const containers = dto.containers ?? [];
      await this.discovery.applySnapshot(containers);

      return { accepted: containers.length };
    });
  }

  /** One container changed, from the agent's docker-events stream. */
  @Public()
  @EventPattern('containers.changed')
  async changed(
    @Payload() dto: ContainerChangedDto,
    @Ctx() context: RmqContext,
  ) {
    await settle(context, () =>
      this.discovery.applyChange(dto.container, dto.removed === true),
    );
  }

  @Public()
  @MessagePattern('agent.heartbeat')
  async heartbeat(
    @Payload() dto: AgentHeartbeatDto,
    @Ctx() context: RmqContext,
  ) {
    return settle(context, async () => {
      this.agentHealth.record(dto);

      // Echoing the interval lets the agent self-tune without a config change.
      return { ok: true, expectedIntervalSeconds: 30 };
    });
  }

  // — deployment process reporting —

  @Public()
  @MessagePattern('deploy.process.register')
  async registerProcess(
    @Payload() dto: RegisterProcessDto,
    @Ctx() context: RmqContext,
  ) {
    return settle(context, () => this.processes.handleRegister(dto));
  }

  /**
   * I4 — every line is scrubbed of secret values before it reaches the database
   * or the WebSocket. `docker compose` echoes environment variables in several
   * situations, and storing one leak also broadcasts it.
   */
  @Public()
  @EventPattern('deploy.process.log')
  async registerProcessLog(
    @Payload() dto: RegisterProcessLogDto,
    @Ctx() context: RmqContext,
  ) {
    await settle(context, async () =>
      this.processes.handleRegisterLog({
        ...dto,
        message: this.redaction.redact(dto.processId, dto.message),
      }),
    );
  }

  @Public()
  @EventPattern('deploy.process.status')
  async changeProcessStatus(
    @Payload() dto: ProcessStatusDto,
    @Ctx() context: RmqContext,
  ) {
    await settle(context, async () => this.processes.handleChangeStatus(dto));
  }

  /**
   * Hands the agent the credentials for one repository, at clone time.
   *
   * Request/reply on purpose: the reply goes to an exclusive, auto-deleting
   * queue, so the token is never persisted the way a durable deploy command
   * would persist it (I8). The agent must not cache it.
   */
  @Public()
  @MessagePattern('deploy.git.credentials')
  async gitCredentials(
    @Payload() dto: { repoId: string },
    @Ctx() context: RmqContext,
  ) {
    return settle(context, async () => {
      const repo = await this.gitRepos.get(dto.repoId);

      if (!repo.account) return { username: null, token: null };

      const credentials = await this.gitAccounts.credentials(repo.account.id);

      return {
        username: credentials.username,
        token: credentials.token,
        provider: credentials.provider,
      };
    });
  }

  /**
   * Outcome of a deployment. Separate from the process status because a release
   * needs to know what actually runs — which digest, which commit, and whether
   * the health gate passed (I15).
   */
  @Public()
  @EventPattern('deploy.release.result')
  async releaseResult(
    @Payload() dto: DeployResultDto,
    @Ctx() context: RmqContext,
  ) {
    await settle(context, () => this.releases.applyResult(dto));
  }
}
