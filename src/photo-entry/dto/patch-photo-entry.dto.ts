import { PhotoEntryType } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class PatchPhotoEntryDto {
  @IsString({ optional: true })
  name?: string;

  @IsEnum({ enum: { PhotoEntryType }, optional: true })
  type?: PhotoEntryType;

  @IsString({ isDate: { format: 'date-time' }, optional: true })
  startDate?: string;

  @IsString({ isDate: { format: 'date-time' }, optional: true })
  endDate?: string;

  @IsString({
    isArray: true,
    optional: true,
    description:
      'ASTRO entries only. Replaces the linked objects; send an empty array to ' +
      'clear them (general astro session). Omit to leave links unchanged. ' +
      'Cannot be changed after folders are created.',
  })
  astroObjectIds?: string[];
}
