import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

import { PublicPostCardResponse } from '../../post/responses';

/** Curated post entry (admin). `post` is a preview card or null when unpublished. */
export class HomeBlockPostResponse {
  @IsString()
  id: string;

  @IsString()
  postId: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsNested({ type: PublicPostCardResponse, optional: true, nullable: true })
  post: PublicPostCardResponse | null;
}
