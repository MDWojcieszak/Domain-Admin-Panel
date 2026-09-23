import { IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../../common/decorators';

/**
 * Asks whether the registry holds a newer image than the one running (§11.5).
 *
 * The agent answers with digests and nothing else — whether that counts as an
 * update, and whether to act on it, is decided here.
 */
@OutboundMessage({
  pattern: 'stack.check-update',
  interaction: 'message',
  summary:
    'Compare the running image digest against the registry. Replies with { current, available }.',
})
export class StackCheckUpdateEvent {
  @IsString()
  project: string;

  @IsString({ nullable: true })
  runDirectory: string | null;

  @IsString({ isArray: true })
  filePaths: string[];

  /** Image reference to resolve in the registry, without a digest. */
  @IsString()
  image: string;

  constructor(
    project: string,
    runDirectory: string | null,
    filePaths: string[],
    image: string,
  ) {
    this.project = project;
    this.runDirectory = runDirectory;
    this.filePaths = filePaths;
    this.image = image;
  }
}
