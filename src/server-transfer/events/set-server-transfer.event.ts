import { ServerTransferResponse } from '../responses';

export class SetServerTransferEvent {
  constructor(
    public readonly serverName: string,
    public readonly categoryValue: string,
    public readonly transferName: string,
    public readonly transfer: ServerTransferResponse,
  ) {}
}
