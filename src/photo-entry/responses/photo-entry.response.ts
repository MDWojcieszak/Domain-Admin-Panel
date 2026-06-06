import { MediaStatus, PhotoEntryStatus, PhotoEntryType } from '@prisma/client';
import { IsBoolean, IsDate, IsEnum, IsString } from 'nestjs-swagger-dto';

export class PhotoEntryResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEnum({ enum: { PhotoEntryType } })
  type: PhotoEntryType;

  @IsEnum({ enum: { PhotoEntryStatus } })
  status: PhotoEntryStatus;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  startDate: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  endDate: Date | null;

  @IsString({ optional: true, nullable: true })
  rootPath: string | null;

  @IsBoolean()
  foldersCreated: boolean;

  @IsEnum({ enum: { MediaStatus } })
  uploadStatus?: MediaStatus;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  foldersCreatedAt: Date | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
