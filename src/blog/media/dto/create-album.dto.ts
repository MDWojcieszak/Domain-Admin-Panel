import { IsString } from 'nestjs-swagger-dto';

export class CreateBlogAlbumDto {
  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Cover image id. Must be a BLOG-scoped image.',
  })
  coverImageId?: string | null;
}
