import { IsNested } from 'nestjs-swagger-dto';
import { PortfolioHomeSectionResponse } from './portfolio-home-section.response';
import { PortfolioImageResponse } from './portfolio-image.response';

/** Everything the public home page needs in one call: hero + gallery sections. */
export class PortfolioHomeResponse {
  /** Curated "Selected Work" images (limited by heroLimit). */
  @IsNested({ type: PortfolioImageResponse, isArray: true })
  hero: PortfolioImageResponse[];

  /** Featured galleries, each with a limited photo preview. */
  @IsNested({ type: PortfolioHomeSectionResponse, isArray: true })
  sections: PortfolioHomeSectionResponse[];
}
