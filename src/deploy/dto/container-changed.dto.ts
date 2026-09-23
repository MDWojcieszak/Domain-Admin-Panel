import { IsBoolean, IsNested } from 'nestjs-swagger-dto';

import { AgentContainerDto } from './agent-container.dto';

/**
 * A single container changed, derived by the agent from `docker events`.
 *
 * One message type covers create, start, health transitions, stop and removal:
 * the agent always sends the container's current shape and the backend
 * recomputes stack status from it (§11.4).
 */
export class ContainerChangedDto {
  @IsNested({ type: AgentContainerDto })
  container: AgentContainerDto;

  /** True when the container is gone; the payload is its last known shape. */
  @IsBoolean({ optional: true })
  removed?: boolean;
}
