import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { PoiPublicResponse } from './poi-public.response';

export class PoiPublicListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: PoiPublicResponse, isArray: true })
  pois: PoiPublicResponse[];
}
