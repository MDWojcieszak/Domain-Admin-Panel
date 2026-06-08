import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { PublicPostCardResponse } from './public-post-card.response';

export class PublicPostListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: PublicPostCardResponse, isArray: true })
  posts: PublicPostCardResponse[];
}
