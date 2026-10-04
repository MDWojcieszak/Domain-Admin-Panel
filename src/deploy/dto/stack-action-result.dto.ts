import { IsBoolean, IsEnum, IsString } from 'nestjs-swagger-dto';

import { StackActionType } from '../agent/events/stack-action.event';

/**
 * How a `stack.action` ended, reported by the agent once it has.
 *
 * `stack.action` is answered with "accepted" before the work starts, so a
 * restart that takes longer than a request does not time out in the panel.
 * Success shows up anyway as `containers.changed`; a failure changes nothing
 * in docker and would otherwise be silent — a port already taken, a missing
 * image. This message is how the panel hears about it.
 */
export class StackActionResultDto {
  @IsString()
  project: string;

  @IsEnum({ enum: { StackActionType } })
  action: StackActionType;

  @IsBoolean()
  success: boolean;

  /** Docker's or compose's own reason, verbatim. Absent on success. */
  @IsString({ optional: true, nullable: true })
  error?: string | null;
}
