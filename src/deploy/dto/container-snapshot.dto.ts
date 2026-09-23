import { IsNested } from 'nestjs-swagger-dto';

import { AgentContainerDto } from './agent-container.dto';

/**
 * Full container list for the host. Sent by the agent when it connects and
 * whenever the backend asks, so the panel's view rebuilds itself rather than
 * being restored from a stale copy.
 */
export class ContainerSnapshotDto {
  @IsNested({ type: AgentContainerDto, isArray: true })
  containers: AgentContainerDto[];
}
