import { PhotoEntryStatus, PhotoEntryType } from '@prisma/client';
import { IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

import { PhotoEntryLocationDto } from '../location/entry-location';

export class CreatePhotoEntryDto {
  @IsString()
  name: string;

  @IsEnum({ enum: { PhotoEntryType } })
  type: PhotoEntryType;

  @IsEnum({ enum: { PhotoEntryStatus } })
  status: PhotoEntryStatus;

  @IsString({ isDate: { format: 'date-time' }, optional: true })
  startDate?: string;

  @IsString({ isDate: { format: 'date-time' }, optional: true })
  endDate?: string;

  @IsString({
    isArray: true,
    optional: true,
    description:
      'Only for ASTRO entries, and optional even then: omit or send an empty ' +
      'array for a general sky / Milky Way / timelapse session not tied to ' +
      'catalogued objects. Must be omitted for GENERAL and WORK entries.',
  })
  astroObjectIds?: string[];

  /** Where the shoot is. Needed for the sky table and the forecast. */
  @IsNested({ type: PhotoEntryLocationDto, optional: true, nullable: true })
  location?: PhotoEntryLocationDto | null;
}
