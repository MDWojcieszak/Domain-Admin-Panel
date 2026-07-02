import { IsBoolean, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';
import { GearItemResponse } from './gear-item.response';

/** A camera system / format section (e.g. "Fujifilm X" — APS-C) with its gear. */
export class GearSystemResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  /** Short format tag, e.g. "APS-C", "Medium Format". */
  @IsString({ optional: true, nullable: true })
  label: string | null;

  /** Why this system (rationale shown under the heading). */
  @IsString({ optional: true, nullable: true })
  description: string | null;

  /** Servable system thumbnail URLs (null when no photo attached). */
  @IsString({ optional: true, nullable: true })
  coverUrl: string | null;

  @IsString({ optional: true, nullable: true })
  lowResUrl: string | null;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsBoolean()
  visible: boolean;

  /** Gear belonging to this system, in curated order. */
  @IsNested({ type: GearItemResponse, isArray: true })
  items: GearItemResponse[];
}
