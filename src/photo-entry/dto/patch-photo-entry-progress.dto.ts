import { IsNumber } from 'nestjs-swagger-dto';

/**
 * Progress at entry level (§7). Written by hand from the panel or by the
 * culling app — both are equal callers of the same endpoint.
 *
 * Every field is optional and nullable: omitting one leaves it alone, while
 * sending null clears it back to "unknown". Unknown is not zero.
 */
export class PatchPhotoEntryProgressDto {
  @IsNumber({ min: 0, optional: true, nullable: true })
  photoCount?: number | null;

  @IsNumber({ min: 0, optional: true, nullable: true })
  selectedCount?: number | null;

  @IsNumber({ min: 0, optional: true, nullable: true })
  editedCount?: number | null;
}
