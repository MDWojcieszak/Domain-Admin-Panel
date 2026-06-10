import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { BlogMediaImageResponse } from './media-image.response';

export class BlogMediaListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: BlogMediaImageResponse, isArray: true })
  images: BlogMediaImageResponse[];
}
