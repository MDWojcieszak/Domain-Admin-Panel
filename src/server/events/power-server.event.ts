import { IsNested, IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../common/decorators';

export class PowerServerContext {
  @IsString()
  serverId: string;
}

@OutboundMessage({
  pattern: 'server.shutdown',
  interaction: 'message',
  summary: 'Request a graceful shutdown of the server.',
})
@OutboundMessage({
  pattern: 'server.reboot',
  interaction: 'message',
  summary: 'Request a reboot of the server.',
})
export class PowerServerEvent {
  @IsNested({ type: PowerServerContext })
  context: PowerServerContext;

  constructor(context: PowerServerContext) {
    this.context = context;
  }
}
