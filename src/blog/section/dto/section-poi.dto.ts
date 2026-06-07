import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class AddSectionPoiDto {
  @IsString()
  poiId: string;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;
}

export class PatchSectionPoiDto {
  @IsNumber({ type: 'integer', optional: true })
  order?: number;
}
