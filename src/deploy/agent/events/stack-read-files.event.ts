import { IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../../common/decorators';

/**
 * Reads the compose files of an adopted stack back off the host, so they can be
 * converted into an AppSpec (§8.5).
 *
 * Read-only and scoped to paths the agent itself reported in the compose
 * labels: it is not a general file-read channel, and must not become one.
 */
@OutboundMessage({
  pattern: 'stack.read-files',
  interaction: 'message',
  summary:
    'Read the compose files of a stack. Replies with { files: [{ path, content }] }.',
})
export class StackReadFilesEvent {
  @IsString()
  project: string;

  @IsString({ nullable: true })
  runDirectory: string | null;

  /** Absolute paths, exactly as reported in com.docker.compose.project.config_files. */
  @IsString({ isArray: true })
  filePaths: string[];

  constructor(
    project: string,
    runDirectory: string | null,
    filePaths: string[],
  ) {
    this.project = project;
    this.runDirectory = runDirectory;
    this.filePaths = filePaths;
  }
}
