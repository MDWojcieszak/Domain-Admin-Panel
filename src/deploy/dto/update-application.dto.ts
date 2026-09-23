import { ApplicationTier } from '@prisma/client';
import { IsBoolean, IsEnum, IsString } from 'nestjs-swagger-dto';

export class UpdateApplicationDto {
  @IsString({ optional: true })
  displayName?: string;

  @IsString({ optional: true })
  description?: string;

  @IsEnum({ enum: { ApplicationTier }, optional: true })
  tier?: ApplicationTier;

  @IsString({ optional: true })
  image?: string;

  @IsString({ optional: true, nullable: true })
  gitRepoId?: string | null;

  @IsBoolean({ optional: true })
  webhookEnabled?: boolean;

  /** AppSpec — validated by the renderer before it is stored. */
  spec?: unknown;
}
