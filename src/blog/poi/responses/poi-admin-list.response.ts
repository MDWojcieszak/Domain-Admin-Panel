import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { PoiAdminResponse } from './poi-admin.response';

export class PoiAdminListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: PoiAdminResponse, isArray: true })
  pois: PoiAdminResponse[];
}
