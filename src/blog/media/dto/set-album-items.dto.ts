import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class BlogAlbumItemInputDto {
  @IsString()
  imageId: string;

  @IsNumber({
    type: 'integer',
    optional: true,
    description: 'Explicit order; defaults to the array index.',
  })
  order?: number;
}

/** Replaces the album's items with this exact (ordered) set. */
export class SetBlogAlbumItemsDto {
  @IsNested({ type: BlogAlbumItemInputDto, isArray: true })
  items: BlogAlbumItemInputDto[];
}
