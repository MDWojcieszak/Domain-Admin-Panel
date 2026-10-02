import { GearCategory, GearOwnership } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

import { GearMediaSource } from '../gear-media-source';

/** One piece of the photographer's kit, for the portfolio "My gear" section. */
export class GearItemResponse {
  @IsString()
  id: string;

  @IsEnum({ enum: { GearCategory } })
  category: GearCategory;

  @IsString()
  brand: string;

  @IsString()
  model: string;

  /** Always OWNED on the public portfolio (P10). */
  @IsEnum({ enum: { GearOwnership } })
  ownership: GearOwnership;

  /** Derived from the category, never stored (D5). */
  @IsEnum({ enum: { GearMediaSource } })
  mediaSource: GearMediaSource;

  /** Owning camera system (null = system-agnostic accessory). */
  @IsString({ optional: true, nullable: true })
  systemId: string | null;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  /** Servable thumbnail URLs (null when no photo attached). */
  @IsString({ optional: true, nullable: true })
  coverUrl: string | null;

  @IsString({ optional: true, nullable: true })
  lowResUrl: string | null;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsBoolean()
  visible: boolean;
}
