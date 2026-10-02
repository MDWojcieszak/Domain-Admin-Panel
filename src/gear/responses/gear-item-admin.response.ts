import { IsDate, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

import { GearItemResponse } from './gear-item.response';

/** The entry a piece of gear is needed for (or was missed on). */
export class GearEntryRefResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  startDate: Date | null;
}

/**
 * Gear as the owner sees it: ownership history, wishlist details and when it
 * is needed. Never served on the public portfolio — prices and the shopping
 * list stay private (P10).
 */
export class GearItemAdminResponse extends GearItemResponse {
  @IsDate({ format: 'date-time', optional: true, nullable: true })
  acquiredAt: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  retiredAt: Date | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  priority: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  estimatedPrice: number | null;

  @IsString({ optional: true, nullable: true })
  purchaseUrl: string | null;

  /**
   * Start of the earliest upcoming PLANNED entry this gear is on (§4). For
   * WISHLIST it is the purchase deadline, for OWNED the next use; on RETIRED
   * gear it flags a stale plan.
   */
  @IsDate({ format: 'date-time', optional: true, nullable: true })
  neededBy: Date | null;

  @IsNested({ type: GearEntryRefResponse, optional: true, nullable: true })
  neededFor: GearEntryRefResponse | null;

  /** WISHLIST only: shoots that happened without it being bought. */
  @IsNested({ type: GearEntryRefResponse, isArray: true })
  missedFor: GearEntryRefResponse[];
}

export class GearItemListResponse {
  @IsNested({ type: GearItemAdminResponse, isArray: true })
  items: GearItemAdminResponse[];

  /**
   * Sum of `estimatedPrice` over the WISHLIST items in this list — with
   * `neededWithinDays`, "how much do I have to spend in that window".
   */
  @IsNumber({ type: 'integer' })
  wishlistTotal: number;
}
