import { IsString, IsEnum, IsDate, IsObject } from 'nestjs-swagger-dto';
import { ApiKeyType, ConnectedServiceType } from '@prisma/client';

export class TokenMetadataResponseDto {
  @IsString()
  id: string;

  @IsEnum({ enum: { ConnectedServiceType } })
  service: ConnectedServiceType;

  @IsString()
  name: string;

  @IsEnum({ enum: { ApiKeyType } })
  type: ApiKeyType;

  @IsDate({ format: 'date-time', optional: true })
  expiresAt?: Date;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;

  @IsObject({ optional: true })
  meta?: Object;
}
