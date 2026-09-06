import { DeviceAuthorizationStatus, IntegrationPlatform } from '@prisma/client';
import { IsDate, IsEnum, IsString } from 'nestjs-swagger-dto';

/** What the approval screen renders before the user decides. */
export class DeviceApprovalRequestResponse {
  @IsString({ example: 'WXYZ-1234' })
  userCode: string;

  @IsString({ example: 'Photo Desktop' })
  clientName: string;

  @IsEnum({ enum: { IntegrationPlatform } })
  platform: IntegrationPlatform;

  /** Exactly what the user is about to grant — render these, do not hide them. */
  @IsString({ isArray: true })
  scopes: string[];

  @IsDate({ format: 'date-time' })
  expiresAt: Date;
}

export class DeviceApprovalResultResponse {
  @IsString()
  userCode: string;

  @IsString()
  clientName: string;

  @IsEnum({ enum: { IntegrationPlatform } })
  platform: IntegrationPlatform;

  @IsString({ isArray: true })
  scopes: string[];

  @IsEnum({ enum: { DeviceAuthorizationStatus } })
  status: DeviceAuthorizationStatus;
}
