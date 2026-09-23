import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { WebsocketGateway, WsRoom } from '../../websocket/websocket.gateway';
import { RuntimeStatusService } from '../agent/runtime-status.service';
import {
  DiscoveredContainer,
  DiscoveredStack,
  groupIntoStacks,
} from './container-classifier';

/**
 * Holds the panel's view of every container on the host (§8.4, §11.4).
 *
 * Deliberately in memory: `docker ps` output is volatile, and a database copy
 * would go stale the moment the backend is down. The agent republishes a full
 * snapshot when it connects, and the backend can ask for one at any time, so
 * the view rebuilds itself rather than being restored.
 */

export interface DiscoverySnapshot {
  stacks: DiscoveredStack[];
  receivedAt: Date | null;
  /** False until the agent has reported once — the panel shows "unknown", not "empty". */
  known: boolean;
}

@Injectable()
export class ContainerDiscoveryService {
  private readonly logger = new Logger(ContainerDiscoveryService.name);

  private readonly containers = new Map<string, DiscoveredContainer>();
  private receivedAt: Date | null = null;

  constructor(
    private readonly websocket: WebsocketGateway,
    private readonly runtimeStatus: RuntimeStatusService,
  ) {}

  /** Full replace, from the agent's startup snapshot or an explicit request. */
  async applySnapshot(containers: DiscoveredContainer[]): Promise<void> {
    this.containers.clear();
    for (const container of containers) {
      this.containers.set(container.id, container);
    }
    this.receivedAt = new Date();

    this.logger.log(
      `Container snapshot: ${containers.length} container(s) in ${this.stacks().length} stack(s)`,
    );

    await this.syncManagedStatuses();
    this.websocket.emitToRoom(WsRoom.DEPLOYMENTS, 'containers.snapshot', {
      receivedAt: this.receivedAt,
      stacks: this.stacks().length,
    });
  }

  /** One container changed, from the agent's docker-events stream. */
  async applyChange(
    container: DiscoveredContainer,
    removed = false,
  ): Promise<void> {
    if (removed) this.containers.delete(container.id);
    else this.containers.set(container.id, container);

    this.receivedAt = new Date();

    await this.syncManagedStatuses();
    this.websocket.emitToRoom(WsRoom.DEPLOYMENTS, 'container.changed', {
      id: container.id,
      removed,
    });
  }

  snapshot(): DiscoverySnapshot {
    return {
      stacks: this.stacks(),
      receivedAt: this.receivedAt,
      known: this.receivedAt !== null,
    };
  }

  stacks(): DiscoveredStack[] {
    return groupIntoStacks([...this.containers.values()]);
  }

  stack(project: string): DiscoveredStack {
    const found = this.stacks().find((s) => s.project === project);

    if (!found) {
      throw new NotFoundException(
        `No container stack named "${project}" is currently reported by the agent.`,
      );
    }

    return found;
  }

  /**
   * The agent stopped reporting, so the view is stale. Cleared rather than
   * frozen: showing a week-old "running" as current is worse than showing
   * nothing (§13.3).
   */
  forget(): void {
    this.containers.clear();
    this.receivedAt = null;
  }

  private async syncManagedStatuses(): Promise<void> {
    const managed = this.stacks().filter((stack) => stack.slug);

    for (const stack of managed) {
      await this.runtimeStatus.apply(
        stack.slug as string,
        stack.runtimeStatus,
        `${stack.containers.length} container(s)`,
      );
    }
  }
}
