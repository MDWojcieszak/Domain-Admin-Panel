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

  @IsString({ isArray: true, optional: true })
  astroObjectIds?: string[];
}
