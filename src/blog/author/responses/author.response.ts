import { IsNested, IsString } from 'nestjs-swagger-dto';

/** Public byline projection — name + avatar only, never email. */
export class PublicAuthorResponse {
  @IsString()
  userId: string;

  @IsString({ optional: true, nullable: true })
  displayName: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Avatar image id → GET /image/cover?id=',
  })
  avatarImageId: string | null;
}

export class PublicAuthorListResponse {
  @IsNested({ type: PublicAuthorResponse, isArray: true })
  authors: PublicAuthorResponse[];
}
