import { IsString } from 'nestjs-swagger-dto';

export enum ImageSizeType {
  ORIGINAL = 'ORIGINAL',
  COVER = 'COVER',
  LOW_RES = 'LOW_RES',
  THUMB = 'THUMB',
}

export class ImageDto {
  @IsString()
  id: string;
}
