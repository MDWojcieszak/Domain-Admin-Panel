import { IsNested } from 'nestjs-swagger-dto';
import { PortfolioGalleryResponse } from './portfolio-gallery.response';
import { PortfolioImageResponse } from './portfolio-image.response';

/** A gallery on the home page: its summary + a limited preview of its photos. */
export class PortfolioHomeSectionResponse extends PortfolioGalleryResponse {
  /** First N visible images (N = per-gallery override or global default). */
  @IsNested({ type: PortfolioImageResponse, isArray: true })
  previewItems: PortfolioImageResponse[];
}
