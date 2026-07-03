import { IsNumber } from 'nestjs-swagger-dto';

export class UpdatePortfolioSettingsDto {
  @IsNumber({ type: 'integer', optional: true })
  heroLimit?: number;

  @IsNumber({ type: 'integer', optional: true })
  galleryPreviewCount?: number;

  /** null = show all featured galleries on home. */
  @IsNumber({ type: 'integer', optional: true, nullable: true })
  homeGalleryLimit?: number | null;

  @IsNumber({ type: 'integer', optional: true })
  galleryPageSize?: number;
}
