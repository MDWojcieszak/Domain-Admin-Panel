import { PhotoEntryStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { GearItemResponse } from '../../gear/responses';
import { EntryGearPhase, EntryGearWarning } from './photo-entry-gear-rules';

export class PhotoEntryGearItemResponse {
  @IsNested({ type: GearItemResponse })
  gear: GearItemResponse;

  @IsBoolean()
  packed: boolean;

  @IsBoolean()
  used: boolean;

  @IsBoolean()
  secured: boolean;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  securedAt: Date | null;

  @IsString({ optional: true, nullable: true })
  note: string | null;

  /** Belongs on the list for the entry's current phase (D4). */
  @IsBoolean()
  listed: boolean;

  /** Used, produces media and not yet secured. */
  @IsBoolean()
  needsSecuring: boolean;

  /** What to do to secure it, e.g. "offload the card"; null when nothing. */
  @IsString({ optional: true, nullable: true })
  secureAction: string | null;

  @IsEnum({ enum: { EntryGearWarning }, optional: true, nullable: true })
  warning: EntryGearWarning | null;
}

export class PhotoEntryGearListResponse {
  @IsString()
  photoEntryId: string;

  @IsEnum({ enum: { PhotoEntryStatus } })
  status: PhotoEntryStatus;

  /** How to read the list: PACK before the shoot, SECURE after it (D4). */
  @IsEnum({ enum: { EntryGearPhase } })
  phase: EntryGearPhase;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  gearConfirmedAt: Date | null;

  /** SHOT and never declared — ask "what gear did you use?" (§5). */
  @IsBoolean()
  needsGearConfirmation: boolean;

  /** §6 — null means unknown (gear not declared yet), not "not secured". */
  @IsBoolean({ optional: true, nullable: true })
  mediaSecured: boolean | null;

  @IsNested({ type: PhotoEntryGearItemResponse, isArray: true })
  items: PhotoEntryGearItemResponse[];
}

export class ShoppingListItemResponse {
  @IsNested({ type: GearItemResponse })
  gear: GearItemResponse;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  priority: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  estimatedPrice: number | null;

  @IsString({ optional: true, nullable: true })
  purchaseUrl: string | null;
}

/** Wishlist gear attached to one entry — "what Iceland still costs me". */
export class PhotoEntryShoppingListResponse {
  @IsString()
  photoEntryId: string;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  neededBy: Date | null;

  @IsNested({ type: ShoppingListItemResponse, isArray: true })
  items: ShoppingListItemResponse[];

  /** Sum of the known estimated prices. */
  @IsNumber({ type: 'integer' })
  total: number;
}
