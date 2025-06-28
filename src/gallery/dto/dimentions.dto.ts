import { IsString } from 'nestjs-swagger-dto';

export class DimensionsDto {
  @IsString()
  width: string;

  @IsString()
  height: string;
}
