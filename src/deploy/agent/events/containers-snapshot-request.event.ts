import { IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../../common/decorators';

/**
 * Asks the agent to republish its full container list.
 *
 * Fire-and-forget on purpose: the answer comes back as a normal
 * `containers.snapshot` message, so there is one code path that populates the
 * view whether the agent volunteered it or was asked. Sent when the backend
 * starts, when the agent reappears, and whenever the panel forces a refresh.
 */
@OutboundMessage({
  pattern: 'containers.snapshot-request',
  interaction: 'event',
  summary:
    'Ask the agent to republish the full container list as containers.snapshot.',
})
export class ContainersSnapshotRequestEvent {
  /** Why the snapshot was requested — agent logs it, useful when debugging. */
  @IsString()
  reason: string;

  constructor(reason: string) {
    this.reason = reason;
  }
}
