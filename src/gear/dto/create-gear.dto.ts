import { GearCategory } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreateGearDto {
  @IsEnum({ enum: { GearCategory } })
  category: GearCategory;

  @IsString()
  brand: string;

  @IsString()
  model: string;

  /** Optional owning camera system. */
  @IsString({ optional: true, nullable: true })
  systemId?: string | null;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  /** Optional gallery image used as the gear thumbnail. */
  @IsString({ optional: true, nullable: true })
  imageId?: string | null;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsBoolean({ optional: true })
  visible?: boolean;
}
