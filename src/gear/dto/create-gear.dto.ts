import { GearCategory, GearOwnership } from '@prisma/client';
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

  /**
   * Have it, want it, or had it (§4). Moving to OWNED or RETIRED stamps
   * acquiredAt / retiredAt when they are still empty.
   */
  @IsEnum({ enum: { GearOwnership }, optional: true })
  ownership?: GearOwnership;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  acquiredAt?: string | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  retiredAt?: string | null;

  /** Wishlist urgency: 0 = must-have, higher = less pressing. */
  @IsNumber({ type: 'integer', min: 0, optional: true, nullable: true })
  priority?: number | null;

  /** One currency for the whole instance, so no currency field. */
  @IsNumber({ type: 'integer', min: 0, optional: true, nullable: true })
  estimatedPrice?: number | null;

  @IsString({ optional: true, nullable: true })
  purchaseUrl?: string | null;
}
