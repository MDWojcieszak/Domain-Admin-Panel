import { IsNumber } from 'nestjs-swagger-dto';

/** Public portfolio home settings (display limits the backend enforces). */
export class PortfolioSettingsResponse {
  /** Hero images shown on "Selected Work". */
  @IsNumber({ type: 'integer' })
  heroLimit: number;

  /** Default preview photos shown per gallery on the home page. */
  @IsNumber({ type: 'integer' })
  galleryPreviewCount: number;

  /** How many galleries appear on home (null = all featured). */
  @IsNumber({ type: 'integer', optional: true, nullable: true })
  homeGalleryLimit: number | null;

  /** Suggested page size for the gallery detail page ("load more"). */
  @IsNumber({ type: 'integer' })
  galleryPageSize: number;
}
