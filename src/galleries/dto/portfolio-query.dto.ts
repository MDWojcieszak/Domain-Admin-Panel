import { ImageOrientation } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class PortfolioGalleryQueryDto {
  /** Filter the gallery's images by orientation (ALL / LANDSCAPE / PORTRAIT). */
  @IsEnum({ enum: { ImageOrientation }, optional: true })
  orientation?: ImageOrientation;

  /** Language of the page — the contact form and its privacy notice follow it. */
  @IsString({ optional: true, maxLength: 16 })
  locale?: string;
}
