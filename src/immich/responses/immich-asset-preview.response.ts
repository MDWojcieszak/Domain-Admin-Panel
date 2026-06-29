import { IsString } from 'nestjs-swagger-dto';

export class ImmichAssetPreviewResponse {
  @IsString()
  id: string;

  @IsString({ optional: true })
  originalFileName?: string;

  /** Asset type from Immich: IMAGE | VIDEO | AUDIO | OTHER. */
  @IsString({ optional: true })
  type?: string;

  @IsString({ optional: true })
  localDateTime?: string;

  /** Base64 thumbhash — render a blurry placeholder client-side, no fetch. */
  @IsString({ optional: true, nullable: true })
  thumbhash?: string | null;

  /** Relative proxy URL for the crisp thumbnail (served by this backend). */
  @IsString()
  thumbnailUrl: string;
}
