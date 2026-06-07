import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class AddPoiImageDto {
  @IsString()
  imageId: string;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;
}
