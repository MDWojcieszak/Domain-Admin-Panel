import { IsBoolean, IsNested, IsString } from 'nestjs-swagger-dto';

/** Flags settable when adding gear to an entry. */
export class AddPhotoEntryGearDto {
  @IsBoolean({ optional: true })
  packed?: boolean;

  /** SHOT entries only, and never for wishlist gear (P11, P13). */
  @IsBoolean({ optional: true })
  used?: boolean;

  /** e.g. "card 2 full", "battery died after an hour". */
  @IsString({ optional: true, nullable: true })
  note?: string | null;
}

export class PhotoEntryGearInputDto extends AddPhotoEntryGearDto {
  @IsString()
  gearItemId: string;
}

/**
 * The whole list at once — planning a trip, or declaring after the fact what
 * was used. Rows missing from `items` are removed; omitted flags on rows that
 * already exist are left alone.
 */
export class PutPhotoEntryGearDto {
  @IsNested({ type: PhotoEntryGearInputDto, isArray: true })
  items: PhotoEntryGearInputDto[];
}

/**
 * Ticking one row. `secured: true` implies `used`, and `used: false` clears
 * `secured`, so the two never contradict each other.
 */
export class PatchPhotoEntryGearDto extends AddPhotoEntryGearDto {
  /** Media brought in: card offloaded, film developed and scanned (D5). */
  @IsBoolean({ optional: true })
  secured?: boolean;
}
