import { IntegrationPlatform } from '@prisma/client';
import { IsBoolean, IsDate, IsEnum, IsString } from 'nestjs-swagger-dto';

/** Manual "generate and copy" path — the fallback to the device flow. */
export class CreateIntegrationTokenDto {
  @IsString({ maxLength: 64, example: 'Ingest script' })
  name: string;

  @IsEnum({ enum: { IntegrationPlatform }, optional: true })
  platform?: IntegrationPlatform;

  @IsString({
    isArray: true,
    example: ['photoEntry.read'],
    description: 'Permission keys from the ACL catalog',
  })
  scopes: string[];

  @IsBoolean({
    optional: true,
    description:
      'Defaults to true (one year). Set false for a non-expiring token.',
  })
  expires?: boolean;

  @IsDate({ format: 'date-time', optional: true })
  expiresAt?: Date;
}
