import { PhotoEntryStatus, PhotoEntryType } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

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
}
