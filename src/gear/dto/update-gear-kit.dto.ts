import { IsString } from 'nestjs-swagger-dto';

export class UpdateGearKitDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  /** When sent, replaces the kit's contents as a whole. */
  @IsString({ isArray: true, optional: true })
  gearItemIds?: string[];
}
