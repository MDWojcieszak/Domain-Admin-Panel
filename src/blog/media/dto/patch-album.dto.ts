import { IsString } from 'nestjs-swagger-dto';

export class PatchBlogAlbumDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Cover image id (BLOG-scoped). Pass null to clear.',
  })
  coverImageId?: string | null;
}
