import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

import { toNumber } from '../../common/helpers/cast.to-number';

import { PreviewSize } from './export-files';

/**
 * Publish selected export files to a gallery. Exactly one target: an existing
 * `galleryId`, or `newGallery: true` (created as DRAFT, D2).
 */
export class PublishExportsDto {
  /** Keys from the scan, in the order the photos should appear. */
  @IsString({ isArray: true, minLength: 1 })
  keys: string[];

  @IsString({ optional: true })
  galleryId?: string;

  @IsBoolean({ optional: true })
  newGallery?: boolean;

  /** Title of the new gallery; defaults to the entry name. */
  @IsString({ optional: true, maxLength: 200 })
  newGalleryTitle?: string;
}

/** Query of a signed preview URL — issued by the scan, never built by hand. */
export class ExportPreviewQueryDto {
  @IsString()
  key: string;

  @IsEnum({ enum: { PreviewSize } })
  size: PreviewSize;

  @Transform(({ value }) => toNumber(value))
  @IsNumber({ type: 'integer' })
  exp: number;

  @IsString()
  sig: string;
}
