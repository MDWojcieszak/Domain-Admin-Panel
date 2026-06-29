import { IsEnum } from 'nestjs-swagger-dto';

/**
 * Allowed thumbnail sizes via the proxy. Intentionally excludes `fullsize` /
 * `original` so the proxy can't be used to exfiltrate full-resolution assets.
 */
export enum ThumbnailSize {
  thumbnail = 'thumbnail',
  preview = 'preview',
}

export class GetThumbnailQueryDto {
  @IsEnum({ enum: { ThumbnailSize }, optional: true })
  size?: ThumbnailSize;
}
