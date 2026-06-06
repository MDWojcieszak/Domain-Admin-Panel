import { IsNested } from 'nestjs-swagger-dto';

import { CommandContext } from '../../common/types';
import { OutboundMessage } from '../../common/decorators';

@OutboundMessage({
  pattern: '{commandValue}',
  interaction: 'message',
  summary:
    'Execute a registered command. The pattern equals ServerCommand.value (CommandType MESSAGE = request/reply, EVENT = fire-and-forget).',
  parameters: {
    commandValue: {
      description:
        'Equals the ServerCommand.value the agent registered via commands.register.',
      schema: { type: 'string' },
    },
  },
})
export class SendCommandEvent {
  @IsNested({ type: CommandContext })
  context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }
}
