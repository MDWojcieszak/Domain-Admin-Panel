import { IsString } from 'nestjs-swagger-dto';

export class CheckComposeDto {
  @IsString()
  compose: string;
}

export class TakeoverComposeDto {
  /**
   * The stack's compose file, pasted. Omit to read it from the host through
   * the agent.
   */
  @IsString({ optional: true })
  compose?: string;
}
