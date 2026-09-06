import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { IntegrationTokenResponse } from './integration-token.response';

export class IntegrationTokenListResponse {
  @IsNested({ type: IntegrationTokenResponse, isArray: true })
  tokens: IntegrationTokenResponse[];

  @IsNumber({ type: 'integer' })
  total: number;
}
