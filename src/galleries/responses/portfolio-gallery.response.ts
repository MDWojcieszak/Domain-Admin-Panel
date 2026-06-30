import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class PortfolioGalleryResponse {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsString({ optional: true, nullable: true })
  coverUrl: string | null;

  /** Number of visible (non-hidden) images. */
  @IsNumber({ type: 'integer' })
  imageCount: number;
}
