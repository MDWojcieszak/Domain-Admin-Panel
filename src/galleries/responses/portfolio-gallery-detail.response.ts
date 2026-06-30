import { IsNested } from 'nestjs-swagger-dto';
import { PortfolioGalleryResponse } from './portfolio-gallery.response';
import { PortfolioImageResponse } from './portfolio-image.response';

export class PortfolioGalleryDetailResponse extends PortfolioGalleryResponse {
  @IsNested({ type: PortfolioImageResponse, isArray: true })
  items: PortfolioImageResponse[];
}
