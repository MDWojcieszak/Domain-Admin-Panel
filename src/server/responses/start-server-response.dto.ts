import { ServerStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsString } from 'nestjs-swagger-dto';

export class StartServerResponseDto {
  @IsBoolean()
  success: boolean;

  @IsString()
  serverId: string;

  @IsEnum({ enum: { ServerStatus } })
  newStatus: ServerStatus;

  @IsString({ optional: true })
  message?: string;
}
