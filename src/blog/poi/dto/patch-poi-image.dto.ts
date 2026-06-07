import { IsNumber } from 'nestjs-swagger-dto';

export class PatchPoiImageDto {
  @IsNumber({ type: 'integer', optional: true })
  order?: number;
}
