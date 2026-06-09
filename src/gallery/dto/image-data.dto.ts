import { IsString, IsDate } from 'nestjs-swagger-dto';

export class GalleryImageDataDto {
  @IsString({ optional: true })
  title?: string;

  @IsDate({ format: 'date-time' })
  dateTaken: Date;

  @IsString({ optional: true })
  localization?: string;

  @IsString({ optional: true })
  description?: string;
}
