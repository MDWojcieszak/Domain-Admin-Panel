import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PortfolioGalleryResponse } from './portfolio-gallery.response';

export class PortfolioGalleryListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: PortfolioGalleryResponse, isArray: true })
  galleries: PortfolioGalleryResponse[];
}
