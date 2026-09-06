import { IntegrationPlatform } from '@prisma/client';
import { IsDate, IsEnum, IsString } from 'nestjs-swagger-dto';

/** Metadata only — the token value itself is never returned after creation. */
export class IntegrationTokenResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEnum({ enum: { IntegrationPlatform } })
  platform: IntegrationPlatform;

  /** Tail of the secret, for "…a3f9" in the integrations list. */
  @IsString({ example: 'a3f9' })
  lastFour: string;

  @IsString({ isArray: true })
  scopes: string[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  expiresAt: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  lastUsedAt: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  revokedAt: Date | null;
}
