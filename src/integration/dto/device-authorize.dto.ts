import { IntegrationPlatform } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class DeviceAuthorizeDto {
  @IsString({
    maxLength: 64,
    example: 'Photo Desktop',
    description: 'Shown to the user on the approval screen',
  })
  clientName: string;

  @IsEnum({ enum: { IntegrationPlatform } })
  platform: IntegrationPlatform;

  @IsString({
    isArray: true,
    example: ['photoEntry.read', 'photoEntry.manage'],
    description: 'Permission keys from the ACL catalog',
  })
  scopes: string[];
}
