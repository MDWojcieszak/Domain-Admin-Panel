import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { ServerTransferResponse } from './server-transfer.response';

export class ServerTransferListResponse {
  @IsNested({ type: ServerTransferResponse, isArray: true })
  transfers: ServerTransferResponse[];

  @IsNumber()
  total: number;
}
