import { IsNested } from 'nestjs-swagger-dto';

import { PublicPostCardResponse } from '../../post/responses';

/** Opinionated homepage: an ordered list of post cards (pinned slots + latest). */
export class PublicHomeResponse {
  @IsNested({ type: PublicPostCardResponse, isArray: true })
  posts: PublicPostCardResponse[];
}
