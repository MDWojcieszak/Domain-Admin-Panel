import { IsEnum } from 'nestjs-swagger-dto';

/** Notification kinds an admin can fire as a self-test. */
export enum TestNotificationType {
  SERVER_ONLINE = 'SERVER_ONLINE',
  SERVER_OFFLINE = 'SERVER_OFFLINE',
  SERVER_WAKE_FAILED = 'SERVER_WAKE_FAILED',
  SERVER_IDLE = 'SERVER_IDLE',
  PROCESS_FAILED = 'PROCESS_FAILED',
}

export class SendTestNotificationDto {
  @IsEnum({ enum: { TestNotificationType } })
  type: TestNotificationType;
}
