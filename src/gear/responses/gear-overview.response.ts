import { IsNested } from 'nestjs-swagger-dto';
import { GearItemResponse } from './gear-item.response';
import { GearSystemResponse } from './gear-system.response';

/** The whole "My gear" section: systems (with their items) + loose accessories. */
export class GearOverviewResponse {
  /** Camera systems in curated order, each carrying its ordered gear items. */
  @IsNested({ type: GearSystemResponse, isArray: true })
  systems: GearSystemResponse[];

  /** Gear not assigned to any system (system-agnostic accessories). */
  @IsNested({ type: GearItemResponse, isArray: true })
  ungrouped: GearItemResponse[];
}
