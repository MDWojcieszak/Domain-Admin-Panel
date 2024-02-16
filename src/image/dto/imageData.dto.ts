import { IsDate, IsString } from 'nestjs-swagger-dto';

export class ImageDataDto {
  @IsString()
  localization: string;

  @IsString({ isDate: { format: 'date-time' } })
  dateTaken: string;

  @IsString({ optional: true })
  title?: string;

  @IsString({ optional: true })
  description?: string;

  @IsString({ optional: true })
  authorId?: string;

  @IsString()
  imageId: string;
}
