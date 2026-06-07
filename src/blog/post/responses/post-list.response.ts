import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { PostResponse } from './post.response';

export class PostListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: PostResponse, isArray: true })
  posts: PostResponse[];
}
