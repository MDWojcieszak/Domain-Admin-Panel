import { IsString } from 'nestjs-swagger-dto';

export class UpdateGalleryDto {
  @IsString({ optional: true, minLength: 1, maxLength: 200 })
  title?: string;

  @IsString({ optional: true, nullable: true, maxLength: 2000 })
  description?: string | null;

  @IsString({ optional: true, maxLength: 200 })
  slug?: string;

  /** Image id used as the gallery cover (must be a GALLERY image). */
  @IsString({ optional: true, nullable: true })
  coverImageId?: string | null;
}
