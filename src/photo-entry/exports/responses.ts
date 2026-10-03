import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { ExportFileStatus } from './export-files';

export class ExportPublicationResponse {
  @IsString({ optional: true, nullable: true })
  imageId: string | null;

  @IsString({ optional: true, nullable: true })
  galleryId: string | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  publishedAt: Date | null;

  @IsString({ optional: true, nullable: true })
  error: string | null;
}

export class ExportFileResponse {
  /** Opaque — send it back to publish; never a path. */
  @IsString()
  key: string;

  @IsString()
  name: string;

  /** Inside the export folder; for display only. */
  @IsString()
  relativePath: string;

  @IsNumber({ type: 'integer' })
  size: number;

  @IsDate({ format: 'date-time' })
  modifiedAt: Date;

  /** As displayed (EXIF orientation applied); null when unreadable. */
  @IsNumber({ type: 'integer', optional: true, nullable: true })
  width: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  height: number | null;

  /** jpeg | png | tiff | webp | avif | heif | raw */
  @IsString()
  format: string;

  @IsBoolean()
  publishable: boolean;

  @IsString({ optional: true, nullable: true })
  reason: string | null;

  @IsEnum({ enum: { ExportFileStatus } })
  status: ExportFileStatus;

  @IsNested({ type: ExportPublicationResponse, optional: true, nullable: true })
  publication: ExportPublicationResponse | null;

  /** Signed, expiring (~1 h) URLs relative to the API — plain <img src>. */
  @IsString({ optional: true, nullable: true })
  thumbUrl: string | null;

  @IsString({ optional: true, nullable: true })
  previewUrl: string | null;
}

export class ExportSummaryResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNumber({ type: 'integer' })
  new: number;

  @IsNumber({ type: 'integer' })
  pending: number;

  @IsNumber({ type: 'integer' })
  published: number;

  @IsNumber({ type: 'integer' })
  changed: number;

  @IsNumber({ type: 'integer' })
  failed: number;
}

export class ExportScanResponse {
  @IsString()
  photoEntryId: string;

  /** Inside the entry folder, e.g. 04_EXPORT. */
  @IsString()
  folder: string;

  @IsBoolean()
  folderExists: boolean;

  @IsDate({ format: 'date-time' })
  scannedAt: Date;

  /** When the signed preview URLs stop working — scan again after. */
  @IsDate({ format: 'date-time' })
  urlsExpireAt: Date;

  @IsNested({ type: ExportFileResponse, isArray: true })
  files: ExportFileResponse[];

  @IsNested({ type: ExportSummaryResponse })
  summary: ExportSummaryResponse;
}

export class SkippedExportResponse {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsEnum({ enum: { ExportFileStatus } })
  status: ExportFileStatus;
}

export class PublishExportsResponse {
  @IsString()
  galleryId: string;

  /** Files queued — upload for new ones, in-place replace for re-exports. */
  @IsNumber({ type: 'integer' })
  queued: number;

  /** Already published and unchanged, or already queued. */
  @IsNested({ type: SkippedExportResponse, isArray: true })
  skipped: SkippedExportResponse[];
}
