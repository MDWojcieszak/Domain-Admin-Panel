import { IsNumber, IsString } from 'nestjs-swagger-dto';

/** Auto-extracted "tech specs" for a photo. Fields are null when absent. */
export class ImageExifResponse {
  @IsString({ optional: true, nullable: true })
  cameraMake: string | null;

  @IsString({ optional: true, nullable: true })
  cameraModel: string | null;

  @IsString({ optional: true, nullable: true })
  lens: string | null;

  /** Focal length in mm. */
  @IsNumber({ optional: true, nullable: true })
  focalLength: number | null;

  /** Aperture (f-number). */
  @IsNumber({ optional: true, nullable: true })
  fNumber: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  iso: number | null;

  /** Shutter speed as a display string, e.g. "1/250" or "2s". */
  @IsString({ optional: true, nullable: true })
  exposureTime: string | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  takenAt: Date | null;
}
