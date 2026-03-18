import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { AstroObjectResponse } from './astro-object.response';

export class AstroObjectListResponse {
  @IsNested({ type: AstroObjectResponse, isArray: true })
  astroObjects: AstroObjectResponse[];

  @IsNumber()
  total: number;
}
