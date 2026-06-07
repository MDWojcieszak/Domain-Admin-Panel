import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { VersionSummaryResponse } from './version-summary.response';

export class VersionListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: VersionSummaryResponse, isArray: true })
  versions: VersionSummaryResponse[];
}
