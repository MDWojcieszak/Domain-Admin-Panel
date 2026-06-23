import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PermissionsService } from '../common/acl/permissions.service';
import { TestNotificationType } from './dto';
import { TestNotificationResultDto } from './responses';

/** Boolean fields on UserSettings that gate an email notification channel. */
export type NotificationSetting =
  | 'serverStatusEmailNotifications'
  | 'serverIdleEmailNotifications'
  | 'processEmailNotifications';

/** Schema defaults — decides whether a user with NO settings row opts in. */
const DEFAULT_ON: Record<NotificationSetting, boolean> = {
  serverStatusEmailNotifications: true,
  processEmailNotifications: true,
  serverIdleEmailNotifications: false,
};

export interface EmailNotification {
  setting: NotificationSetting;
  /** ACL permission a user needs to receive this (OWNER always passes). */
  permission: string;
  /** NotificationLog `type` discriminator (e.g. 'SERVER_OFFLINE'). */
  logType: string;
  subject: string;
  /** Highlighted name in the email body (server/process name). */
  subjectName: string;
  headline: string;
  detail: string;
  meta?: Prisma.InputJsonValue;
}

type Recipient = {
  id: string;
  email: string;
  firstName: string | null;
  role: Role;
};

/** Example copy used by the admin self-test endpoint (one per type). */
const TEST_COPY: Record<
  TestNotificationType,
  { subjectName: string; headline: string; detail: string }
> = {
  [TestNotificationType.SERVER_ONLINE]: {
    subjectName: 'example-server',
    headline: 'is now online',
    detail: 'The server is reachable again and reporting heartbeats.',
  },
  [TestNotificationType.SERVER_OFFLINE]: {
    subjectName: 'example-server',
    headline: 'went offline unexpectedly',
    detail:
      'It stopped sending heartbeats without a planned shutdown — it may have crashed or lost connectivity.',
  },
  [TestNotificationType.SERVER_WAKE_FAILED]: {
    subjectName: 'example-server',
    headline: 'failed to wake',
    detail:
      'A Wake-on-LAN start was issued but the server did not come online within the timeout.',
  },
  [TestNotificationType.SERVER_IDLE]: {
    subjectName: 'example-server',
    headline: 'has been idle',
    detail:
      'It has been online with no active processes for a while — you may want to shut it down to save power.',
  },
  [TestNotificationType.PROCESS_FAILED]: {
    subjectName: 'start_mc',
    headline: 'failed on example-server',
    detail:
      'The process ended in a FAILED state. Check its logs in the panel for the cause.',
  },
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Emails opted-in, permitted users and records each in NotificationLog.
   * Fire-and-forget safe: never throws (errors logged + recorded as FAILED).
   */
  async emailUsers(n: EmailNotification): Promise<void> {
    try {
      const recipients = await this.recipients(n.setting, n.permission);
      for (const user of recipients) {
        await this.dispatch(user, n);
      }
    } catch (err) {
      this.logger.error(
        `Notification (${n.logType}) failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Sends one notification type to the caller's OWN email (admin self-test).
   * Ignores settings/permissions (it only ever reaches the requester). Surfaces
   * delivery failure to the caller, and records the attempt in NotificationLog.
   */
  async sendTest(
    userId: string,
    type: TestNotificationType,
  ): Promise<TestNotificationResultDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const copy = TEST_COPY[type];
    try {
      await this.mail.sendNotification({
        email: user.email,
        firstName: user.firstName ?? 'there',
        subject: `[Test] ${copy.subjectName} ${copy.headline}`,
        subjectName: copy.subjectName,
        headline: copy.headline,
        detail: copy.detail,
      });
      await this.log(userId, `TEST_${type}`, 'SENT', { test: true });
      return { delivered: true, email: user.email };
    } catch (err) {
      await this.log(userId, `TEST_${type}`, 'FAILED', { test: true });
      throw new InternalServerErrorException(
        `Failed to send test email: ${(err as Error).message}`,
      );
    }
  }

  /** Active users opted into `setting` (default applies when no row) who hold
   * `permission` (or are OWNER). */
  private async recipients(
    setting: NotificationSetting,
    permission: string,
  ): Promise<Recipient[]> {
    const enabled = { [setting]: true } as Prisma.UserSettingsWhereInput;
    const settingFilter: Prisma.UserWhereInput = DEFAULT_ON[setting]
      ? { OR: [{ userSettings: { is: null } }, { userSettings: enabled }] }
      : { userSettings: enabled };

    const users = await this.prisma.user.findMany({
      where: {
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        ...settingFilter,
      },
      select: { id: true, email: true, firstName: true, role: true },
    });

    const allowed: Recipient[] = [];
    for (const user of users) {
      const canRead =
        user.role === Role.OWNER ||
        (await this.permissions.getEffectivePermissions(user.id)).has(
          permission,
        );
      if (canRead) allowed.push(user);
    }
    return allowed;
  }

  private async dispatch(
    user: Recipient,
    n: EmailNotification,
  ): Promise<void> {
    try {
      await this.mail.sendNotification({
        email: user.email,
        firstName: user.firstName ?? 'there',
        subject: n.subject,
        subjectName: n.subjectName,
        headline: n.headline,
        detail: n.detail,
      });
      await this.log(user.id, n.logType, 'SENT', n.meta);
    } catch (err) {
      this.logger.error(
        `Notification email to ${user.email} failed: ${(err as Error).message}`,
      );
      await this.log(user.id, n.logType, 'FAILED', n.meta);
    }
  }

  private async log(
    userId: string,
    type: string,
    status: string,
    meta?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.notificationLog
      .create({
        data: { userId, type, status, ...(meta ? { meta } : {}) },
      })
      .catch(() => {
        /* logging must never break the flow */
      });
  }
}
