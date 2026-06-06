import { IsNested, IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../common/decorators';
import { ServerTransferResponse } from '../responses';

@OutboundMessage({
  pattern: 'server.transfer.set',
  interaction: 'event',
  summary: 'Push a transfer task configuration to the server agent.',
})
export class SetServerTransferEvent {
  @IsString()
  serverName: string;

  @IsString()
  categoryValue: string;

  @IsString()
  transferName: string;

  @IsNested({ type: ServerTransferResponse })
  transfer: ServerTransferResponse;

  constructor(
    serverName: string,
    categoryValue: string,
    transferName: string,
    transfer: ServerTransferResponse,
  ) {
    this.serverName = serverName;
    this.categoryValue = categoryValue;
    this.transferName = transferName;
    this.transfer = transfer;
  }
}
