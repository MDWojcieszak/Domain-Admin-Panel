import { Injectable } from '@nestjs/common';

import { PERMISSIONS } from '../../common/acl/permissions';
import { NotificationService } from '../../notification/notification.service';

/**
 * Deployment events worth interrupting someone for (§13.4).
 *
 * Only failures and surprises: a successful deployment is visible in the panel
 * and mailing it would train people to ignore the ones that matter.
 *
 * Everything here is fire-and-forget — `emailUsers` never throws, so a mail
 * outage cannot fail a deployment that otherwise worked.
 */
@Injectable()
export class DeployNotificationService {
  constructor(private readonly notifications: NotificationService) {}

  async releaseFailed(
    slug: string,
    version: string | null,
    reason: string,
  ): Promise<void> {
    await this.notifications.emailUsers({
      setting: 'processEmailNotifications',
      permission: PERMISSIONS.DEPLOY_READ,
      logType: 'DEPLOY_FAILED',
      subject: `Deployment of ${slug} failed`,
      subjectName: slug,
      headline: `failed to deploy${version ? ` version ${version}` : ''}`,
      detail: reason,
      meta: { slug, version, reason },
    });
  }

  async rolledBack(slug: string, reason: string): Promise<void> {
    await this.notifications.emailUsers({
      setting: 'processEmailNotifications',
      permission: PERMISSIONS.DEPLOY_READ,
      logType: 'DEPLOY_ROLLED_BACK',
      subject: `${slug} was rolled back automatically`,
      subjectName: slug,
      headline: 'was rolled back to its previous release',
      // An automatic rollback always means something was wrong, so it is worth
      // a message even though the application is running again.
      detail: `The new release did not pass its health gate: ${reason}`,
      meta: { slug, reason },
    });
  }

  async agentOffline(
    serverName: string,
    silentForSeconds: number,
  ): Promise<void> {
    await this.notifications.emailUsers({
      setting: 'serverStatusEmailNotifications',
      permission: PERMISSIONS.DEPLOY_READ,
      logType: 'DEPLOY_AGENT_OFFLINE',
      subject: `Deploy agent on ${serverName} is offline`,
      subjectName: serverName,
      headline: 'stopped reporting',
      detail:
        `No heartbeat for ${silentForSeconds}s. Deployments are unavailable and ` +
        'container status in the panel is no longer current.',
      meta: { serverName, silentForSeconds },
    });
  }

  async updateAvailable(slug: string, digest: string): Promise<void> {
    await this.notifications.emailUsers({
      setting: 'processEmailNotifications',
      permission: PERMISSIONS.DEPLOY_READ,
      logType: 'DEPLOY_UPDATE_AVAILABLE',
      subject: `A newer image is available for ${slug}`,
      subjectName: slug,
      headline: 'has a newer image in the registry',
      detail: `Registry digest ${digest.slice(0, 19)}… differs from the running one.`,
      meta: { slug, digest },
    });
  }
}
