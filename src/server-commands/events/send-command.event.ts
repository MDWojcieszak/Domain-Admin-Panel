import { CommandContext } from '../../common/types';

export class SendCommandEvent {
  constructor(public readonly context: CommandContext) {}
}
