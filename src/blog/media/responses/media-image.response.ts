import { IsDate, IsNested, IsString } from 'nestjs-swagger-dto';

export class BlogMediaImageDimensionsResponse {
  @IsString()
  width: string;

  @IsString()
  height: string;
}

/** A single BLOG-scoped image as shown in the media library / album. */
export class BlogMediaImageResponse {
  @IsString()
  id: string;

  @IsNested({
    type: BlogMediaImageDimensionsResponse,
    optional: true,
    nullable: true,
  })
  dimensions: BlogMediaImageDimensionsResponse | null;

  @IsString({ optional: true, nullable: true })
  uploadedById: string | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}
