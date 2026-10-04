import { IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../../common/decorators';

/**
 * Asks the agent to stop a deployment: the step running now is killed and the
 * release reports itself failed. A release that has not started yet is skipped
 * when it arrives. The backend has already marked the release cancelled — the
 * agent's own result for it is ignored.
 */
@OutboundMessage({
  pattern: 'deploy.cancel',
  interaction: 'event',
  summary: 'Stop a running or queued deployment.',
})
export class DeployCancelEvent {
  @IsString()
  releaseId: string;

  constructor(releaseId: string) {
    this.releaseId = releaseId;
  }
}
