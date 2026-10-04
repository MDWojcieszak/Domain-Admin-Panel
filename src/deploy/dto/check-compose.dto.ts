import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class CheckComposeDto {
  @IsString()
  compose: string;

  /**
   * The file is for a git application: it runs from the clone, so relative
   * build contexts mean the repository's code and are accepted.
   */
  @IsBoolean({ optional: true })
  inClone?: boolean;
}

export class TakeoverComposeDto {
  /**
   * The stack's compose file, pasted. Omit to read it from the host through
   * the agent.
   */
  @IsString({ optional: true })
  compose?: string;
}
