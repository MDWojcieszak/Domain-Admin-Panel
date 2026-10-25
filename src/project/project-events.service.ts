import { Injectable } from '@nestjs/common';

import { WebsocketGateway } from '../websocket/websocket.gateway';
import { ProjectAccessService } from './project-access.service';

export type ProjectChangeKind = 'project' | 'status' | 'member' | 'task';

export interface ProjectChangedEvent {
  projectId: string;
  kind: ProjectChangeKind;
  taskId?: string;
  /** Who made the change; null for someone holding a public link. */
  actorId: string | null;
}

/**
 * Live updates (D11): every change goes to the people who may see the
 * project, through their personal rooms. The audience is read at send time,
 * so a removed member stops receiving at once. Public link holders get the
 * same notice, without the actor.
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
    // Link holders learn only that something changed, not who changed it.
    const { actorId: _actor, ...anonymous } = event;
    this.websocket.emitToShareViewers(
      event.projectId,
      'project.changed',
      anonymous,
    );
  }
}
