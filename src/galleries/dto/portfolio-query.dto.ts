import { ImageOrientation } from '@prisma/client';
import { IsEnum } from 'nestjs-swagger-dto';

export class PortfolioGalleryQueryDto {
  /** Filter the gallery's images by orientation (ALL / LANDSCAPE / PORTRAIT). */
  @IsEnum({ enum: { ImageOrientation }, optional: true })
  orientation?: ImageOrientation;
}
