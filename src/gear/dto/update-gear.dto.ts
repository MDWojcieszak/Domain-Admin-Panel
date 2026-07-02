import { GearCategory } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class UpdateGearDto {
  @IsEnum({ enum: { GearCategory }, optional: true })
  category?: GearCategory;

  @IsString({ optional: true })
  brand?: string;

  @IsString({ optional: true })
  model?: string;

  /** Owning camera system (null detaches it). */
  @IsString({ optional: true, nullable: true })
  systemId?: string | null;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  /** Optional gallery image used as the gear thumbnail (null clears it). */
  @IsString({ optional: true, nullable: true })
  imageId?: string | null;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsBoolean({ optional: true })
  visible?: boolean;
}
