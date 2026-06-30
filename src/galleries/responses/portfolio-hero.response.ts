import { IsNested } from 'nestjs-swagger-dto';
import { PortfolioImageResponse } from './portfolio-image.response';

export class PortfolioHeroResponse {
  @IsNested({ type: PortfolioImageResponse, isArray: true })
  images: PortfolioImageResponse[];
}
