import { IsDate, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

class GalleryTotalsDto {
  @IsNumber()
  images: number;

  @IsNumber()
  catalogued: number;

  @IsNumber()
  missingMetadata: number;
}

class GalleryCompletenessDto {
  @IsNumber()
  withoutAuthor: number;

  @IsNumber()
  withoutTitle: number;

  @IsNumber()
  withoutDescription: number;
}

class GalleryAuthorDto {
  @IsString()
  authorId: string;

  @IsString()
  name: string;

  @IsNumber()
  count: number;
}

class GalleryLocalizationDto {
  @IsString()
  key: string;

  @IsNumber()
  count: number;
}

class GalleryRecentDto {
  @IsString()
  imageId: string;

  @IsString({ optional: true })
  title?: string;

  @IsDate({ format: 'date-time' })
  dateTaken: Date;

  @IsString()
  localization: string;

  @IsString({ optional: true })
  author?: string;
}

export class DashboardGalleryResponseDto {
  @IsNested({ type: GalleryTotalsDto })
  totals: GalleryTotalsDto;

  @IsNested({ type: GalleryCompletenessDto })
  completeness: GalleryCompletenessDto;

  @IsNested({ type: GalleryAuthorDto, isArray: true })
  byAuthor: GalleryAuthorDto[];

  @IsNested({ type: GalleryLocalizationDto, isArray: true })
  byLocalization: GalleryLocalizationDto[];

  @IsNested({ type: GalleryRecentDto, isArray: true })
  recent: GalleryRecentDto[];
}
