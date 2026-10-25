import { Injectable } from '@nestjs/common';

import { WebsocketGateway } from '../websocket/websocket.gateway';
import { ProjectAccessService } from './project-access.service';

export type ProjectChangeKind = 'project' | 'status' | 'member' | 'task';

export interface ProjectChangedEvent {
  projectId: string;
  kind: ProjectChangeKind;
  taskId?: string;
  /** Who made the change, so their own client can skip the refetch. */
  actorId: string;
}

/**
 * Live updates (D11): every change goes to the people who may see the
 * project, through their personal rooms. The audience is read at send time,
 * so a removed member stops receiving at once.
 */
@Injectable()
export class ProjectEventsService {
  constructor(
    private readonly websocket: WebsocketGateway,
    private readonly access: ProjectAccessService,
  ) {}

  async changed(
    event: ProjectChangedEvent,
    alsoNotify: string[] = [],
  ): Promise<void> {
    const audience = await this.access.audience(event.projectId);
    this.websocket.emitToUsers(
      [...audience, ...alsoNotify],
      'project.changed',
      event,
    );
  }
}
