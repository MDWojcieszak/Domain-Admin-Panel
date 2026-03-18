import { PhotoEntryStatus, PhotoEntryType } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class GetPhotoEntriesQueryDto {
  @IsEnum({ enum: { PhotoEntryType }, optional: true })
  type?: PhotoEntryType;

  @IsEnum({ enum: { PhotoEntryStatus }, optional: true })
  status?: PhotoEntryStatus;

  @IsString({ optional: true })
  astroObjectId?: string;

  @IsString({ optional: true })
  search?: string;

  @IsNumber({ type: 'integer', optional: true })
  take?: number;

  @IsNumber({ type: 'integer', optional: true })
  skip?: number;
}
