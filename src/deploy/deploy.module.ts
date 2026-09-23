import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ServerOutboundMessagingModule } from '../server-outbound/server-outbound-messaging.module';
import { NotificationModule } from '../notification/notification.module';
import { ServerProcessModule } from '../server-process/server-process.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { AgentHealthService } from './agent/agent-health.service';
import { AgentServerService } from './agent/agent-server.service';
import { DeployAgentGateway } from './agent/deploy-agent.gateway';
import { RuntimeStatusService } from './agent/runtime-status.service';
import { ApplicationImportService } from './application/application-import.service';
import { ApplicationService } from './application/application.service';
import { GitAccountService } from './git/git-account.service';
import { GitRepoService } from './git/git-repo.service';
import { ComposeImporterService } from './renderer/compose-importer.service';
import { AuditService } from './audit/audit.service';
import { DeployAgentController } from './deploy-agent.controller';
import { DeployController } from './deploy.controller';
import { AdoptionService } from './discovery/adoption.service';
import { ContainerDiscoveryService } from './discovery/container-discovery.service';
import { InterpolatorService } from './interpolation/interpolator.service';
import { DeployNotificationService } from './notifications/deploy-notification.service';
import { ReleaseSweeperService } from './release/release-sweeper.service';
import { ReleaseService } from './release/release.service';
import { UpdatePollerService } from './release/update-poller.service';
import { ComposeRendererService } from './renderer/compose-renderer.service';
import { DeployRenderService } from './renderer/deploy-render.service';
import { LogRedactionService } from './secrets/log-redaction.service';
import { SecretCryptoService } from './secrets/secret-crypto.service';
import { VariableService } from './variable/variable.service';
import { DeployWebhookController } from './webhook/deploy-webhook.controller';
import { DeployWebhookService } from './webhook/deploy-webhook.service';

/**
 * Deployment panel.
 *
 * Phase 1: data model, renderer, interpolation, secrets, audit trail.
 * Phase 2: agent contract in both directions, container discovery and
 *          classification, adoption of running stacks, lifecycle actions,
 *          runtime status, agent heartbeat.
 *
 * Deployment execution (releases, the deploy command, rollback) is phase 3;
 * see docs/deploy-design.md §16.
 *
 * PermissionsService comes from the global AclCoreModule.
 */
@Module({
  imports: [
    PrismaModule,
    WebsocketModule,
    ServerOutboundMessagingModule,
    ServerProcessModule,
    NotificationModule,
  ],
  controllers: [
    DeployController,
    DeployAgentController,
    DeployWebhookController,
  ],
  providers: [
    AdoptionService,
    AgentHealthService,
    AgentServerService,
    ApplicationImportService,
    ApplicationService,
    ComposeImporterService,
    GitAccountService,
    GitRepoService,
    AuditService,
    ComposeRendererService,
    ContainerDiscoveryService,
    DeployNotificationService,
    DeployAgentGateway,
    DeployRenderService,
    DeployWebhookService,
    InterpolatorService,
    LogRedactionService,
    ReleaseService,
    ReleaseSweeperService,
    RuntimeStatusService,
    SecretCryptoService,
    UpdatePollerService,
    VariableService,
  ],
  exports: [ComposeRendererService, DeployRenderService, AuditService],
})
export class DeployModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(DeployModule.name);

  constructor(
    private readonly agentHealth: AgentHealthService,
    private readonly discovery: ContainerDiscoveryService,
    private readonly runtimeStatus: RuntimeStatusService,
    private readonly agent: DeployAgentGateway,
    private readonly notifications: DeployNotificationService,
  ) {}

  onApplicationBootstrap(): void {
    // When the agent goes quiet the container view is dropped and every runtime
    // status is marked unknown. Wired here rather than as a direct dependency so
    // AgentHealthService stays free of a cycle back into discovery (§13.3).
    this.agentHealth.onOffline(async () => {
      this.discovery.forget();
      await this.runtimeStatus.markAllUnknown();
      await this.notifications.agentOffline('truenas', 90);
    });

    // The agent reappeared after a restart of its own; its snapshot may predate
    // whatever changed while it was gone.
    this.agentHealth.onOnline(async () => {
      await this.agent.requestSnapshot('agent reconnected');
    });

    // The backend restarted, so its in-memory view is empty. Ask rather than
    // wait for the next docker event, which might be hours away on a quiet host.
    void this.requestInitialSnapshot();
  }

  private async requestInitialSnapshot(): Promise<void> {
    try {
      await this.agent.requestSnapshot('backend started');
    } catch (error) {
      // Expected on a fresh install, before any agent has registered.
      this.logger.log(
        `Initial container snapshot not requested: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
