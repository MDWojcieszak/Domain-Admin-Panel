import { IsString } from 'nestjs-swagger-dto';

export enum PHOTO_SIZE {
  COVER = 'COVER',
  LOW_RES = 'LOW_RES',
}

export class PhotoDto {
  @IsString()
  id: string;
}
