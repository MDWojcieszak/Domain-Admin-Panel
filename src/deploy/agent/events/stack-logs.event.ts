import { IsNumber, IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../../common/decorators';

/**
 * One-shot log read. Unlike a deployment, this has no Process behind it — the
 * panel asks, the agent answers, nothing is persisted.
 */
@OutboundMessage({
  pattern: 'stack.logs',
  interaction: 'message',
  summary: 'Fetch the last N log lines of a compose stack or container.',
})
export class StackLogsEvent {
  @IsString()
  project: string;

  @IsString({ nullable: true })
  runDirectory: string | null;

  @IsString({ isArray: true })
  filePaths: string[];

  @IsString({ isArray: true })
  containerIds: string[];

  @IsNumber()
  tail: number;

  constructor(
    project: string,
    runDirectory: string | null,
    filePaths: string[],
    containerIds: string[],
    tail: number,
  ) {
    this.project = project;
    this.runDirectory = runDirectory;
    this.filePaths = filePaths;
    this.containerIds = containerIds;
    this.tail = tail;
  }
}
