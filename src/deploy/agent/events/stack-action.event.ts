import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../../common/decorators';

export enum StackActionType {
  START = 'start',
  RESTART = 'restart',
  STOP = 'stop',
}

/**
 * Asks the agent to act on a compose stack that is already on the host.
 *
 * The agent acknowledges immediately and does the work afterwards: the
 * resulting state changes arrive over the normal `containers.changed` stream,
 * so the panel never waits on a long `compose restart` and there is one path
 * for container state instead of two.
 */
@OutboundMessage({
  pattern: 'stack.action',
  interaction: 'message',
  summary:
    'Run a lifecycle action (start/restart/stop) on a compose stack. Replies with an acknowledgement; resulting state arrives via containers.changed.',
})
export class StackActionEvent {
  @IsEnum({ enum: { StackActionType } })
  action: StackActionType;

  /** Compose project name, exactly as docker reports it (I10). */
  @IsString()
  project: string;

  /** Working directory from the compose labels; null for standalone containers. */
  @IsString({ nullable: true })
  runDirectory: string | null;

  @IsString({ isArray: true })
  filePaths: string[];

  /**
   * Container ids, so a standalone container with no compose file can still be
   * acted on directly.
   */
  @IsString({ isArray: true })
  containerIds: string[];

  @IsNumber({ optional: true })
  timeoutSeconds?: number;

  constructor(
    action: StackActionType,
    project: string,
    runDirectory: string | null,
    filePaths: string[],
    containerIds: string[],
    timeoutSeconds?: number,
  ) {
    this.action = action;
    this.project = project;
    this.runDirectory = runDirectory;
    this.filePaths = filePaths;
    this.containerIds = containerIds;
    this.timeoutSeconds = timeoutSeconds;
  }
}
