import { IsString } from 'nestjs-swagger-dto';

/** A reusable starting list for a trip, e.g. "GFX travel" (§4). */
export class CreateGearKitDto {
  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  @IsString({ isArray: true, optional: true })
  gearItemIds?: string[];
}
