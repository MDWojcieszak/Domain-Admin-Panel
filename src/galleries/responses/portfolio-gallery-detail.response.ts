import { IsNested } from 'nestjs-swagger-dto';
import { PortfolioGalleryResponse } from './portfolio-gallery.response';
import { PortfolioImageResponse } from './portfolio-image.response';
import { PublicContactResponse } from '../../inquiry/responses';

export class PortfolioGalleryDetailResponse extends PortfolioGalleryResponse {
  @IsNested({ type: PortfolioImageResponse, isArray: true })
  items: PortfolioImageResponse[];
}

/** A published gallery as its page needs it: images plus the contact form. */
export class PortfolioGalleryPageResponse extends PortfolioGalleryDetailResponse {
  /**
   * Contact form in the requested language (`?locale=`), privacy notice
   * included; `enabled: false` → hide the form.
   */
  @IsNested({ type: PublicContactResponse })
  contact: PublicContactResponse;
}
