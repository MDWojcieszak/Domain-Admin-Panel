import { IsString } from 'nestjs-swagger-dto';

export enum ImageSizeType {
  ORIGINAL = 'ORIGINAL',
  COVER = 'COVER',
  LOW_RES = 'LOW_RES',
}

export class ImageDto {
  @IsString()
  id: string;
}
