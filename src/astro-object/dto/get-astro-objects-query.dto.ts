import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class GetAstroObjectsQueryDto {
  @IsString({ optional: true })
  search?: string;

  @IsNumber({ type: 'integer', optional: true })
  take?: number;

  @IsNumber({ type: 'integer', optional: true })
  skip?: number;
}
