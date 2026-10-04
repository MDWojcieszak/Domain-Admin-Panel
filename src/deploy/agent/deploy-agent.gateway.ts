import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { BuildMode } from '@prisma/client';

import { config } from '../../config/config';
import { ServerOutboundMessagingService } from '../../server-outbound/server-outbound-messaging.service';
import {
  DiscoveredStack,
  StackAction,
  StackLifecycleAction,
  assertActionAllowed,
} from '../discovery/container-classifier';
import { parseAppSpec } from '../renderer/app-spec';
import { signMessage } from './message-signature';
import { AgentHealthService } from './agent-health.service';
import {
  ContainersSnapshotRequestEvent,
  DeployCancelEvent,
  DeployCommandEvent,
  DeployFileDto,
  DeployGitDto,
  StackActionEvent,
  StackCheckUpdateEvent,
  StackActionType,
  StackLogsEvent,
  StackReadFilesEvent,
} from './events';

/**
 * Outbound half of the deploy agent contract: everything the backend asks the
 * agent to do.
 *
 * Every call is bounded by a timeout (§12.6). A hung agent must surface as an
 * error the panel can show, never as a request that waits forever.
 */

const ACTION_TIMEOUT_MS = 15_000;
const LOGS_TIMEOUT_MS = 30_000;
const MAX_DEPLOY_MESSAGE_BYTES = 256 * 1024;

export interface DeployRequest {
  releaseId: string;
  processId: string;
  slug: string;
  stackDirectory: string;
  buildMode: BuildMode;
  compose: string;
  env: string;
  spec: ReturnType<typeof parseAppSpec>;
  git?: DeployGitDto | null;
  commitMessage: string;
}

export interface StackActionResult {
  accepted: boolean;
  message?: string;
}

export interface StackUpdateCheck {
  /** Digest of the image currently running; null when nothing runs. */
  current: string | null;
  /** Digest the registry would serve now; null when it could not be read. */
  available: string | null;
}

export interface StackFilesResult {
  files: { path: string; content: string }[];
}

export interface StackLogsResult {
  lines: string[];
}

@Injectable()
export class DeployAgentGateway {
  private readonly logger = new Logger(DeployAgentGateway.name);
  private readonly queue = config().deployAgentQueue;
  private readonly key = config().deployAgentKey;

  constructor(
    private readonly outbound: ServerOutboundMessagingService,
    private readonly health: AgentHealthService,
  ) {}

  /**
   * Fire-and-forget: the agent answers with a normal `containers.snapshot`, so
   * there is one path that fills the view regardless of who asked.
   */
  async requestSnapshot(reason: string): Promise<void> {
    await this.emit(
      'containers.snapshot-request',
      new ContainersSnapshotRequestEvent(reason),
    );

    this.logger.log(`Requested container snapshot: ${reason}`);
  }

  /**
   * A lifecycle action on a stack — or, with `containerId`, on one of its
   * containers only. The origin rules are the stack's either way (I11): one
   * container of a TrueNAS app can be restarted, never stopped.
   */
  async runStackAction(
    stack: DiscoveredStack,
    action: StackLifecycleAction,
    containerId?: string,
  ): Promise<StackActionResult> {
    this.assertAllowed(stack, action);
    this.assertAgentOnline();

    if (containerId && !stack.containers.some((c) => c.id === containerId)) {
      throw new BadRequestException(
        `Container ${containerId.slice(0, 12)} is not part of stack "${stack.project}".`,
      );
    }

    return this.withTimeout(
      this.send<StackActionResult>(
        'stack.action',
        new StackActionEvent(
          action as StackActionType,
          stack.project,
          stack.workingDir,
          stack.configFiles,
          containerId ? [containerId] : stack.containers.map((c) => c.id),
          undefined,
          containerId ? true : undefined,
        ),
      ),
      ACTION_TIMEOUT_MS,
      `${action} on "${stack.project}"`,
    );
  }

  async fetchLogs(
    stack: DiscoveredStack,
    tail: number,
  ): Promise<StackLogsResult> {
    this.assertAllowed(stack, 'logs');
    this.assertAgentOnline();

    return this.withTimeout(
      this.send<StackLogsResult>(
        'stack.logs',
        new StackLogsEvent(
          stack.project,
          stack.workingDir,
          stack.configFiles,
          stack.containers.map((c) => c.id),
          tail,
        ),
      ),
      LOGS_TIMEOUT_MS,
      `logs for "${stack.project}"`,
    );
  }

  /**
   * Sends one deployment. Fire-and-forget: progress and the outcome come back
   * on `deploy.process.*` and `deploy.release.result`, so a long build never
   * holds a request open.
   */
  async sendDeploy(input: DeployRequest): Promise<void> {
    this.assertAgentOnline();

    const spec = input.spec;

    const files: DeployFileDto[] = [
      { path: spec.filePaths[0], content: input.compose },
      {
        path: spec.envFilePath,
        content: input.env,
        mode: '0600',
        // I3 — env values never enter the homelab repo's history.
        gitignore: true,
      },
    ];

    const event = new DeployCommandEvent(
      input.releaseId,
      input.processId,
      input.slug,
      input.stackDirectory,
      input.buildMode,
      files,
      {
        runDirectory: spec.runDirectory,
        filePaths: spec.filePaths,
        envFilePath: spec.envFilePath,
        projectName: spec.projectName,
        autoPull: spec.autoPull,
        destroyBeforeDeploy: spec.destroyBeforeDeploy,
        preDeploy: spec.preDeploy ?? null,
        postDeploy: spec.postDeploy ?? null,
        extraArgs: spec.extraArgs ?? [],
        ignoreServices: spec.ignoreServices ?? [],
        healthTimeout: spec.healthTimeout,
      },
      input.commitMessage,
      input.git,
    );

    this.assertSendable(event, input.slug);

    await this.emit('deploy.execute', event);
    this.logger.log(`Sent deployment ${input.releaseId} for "${input.slug}"`);
  }

  /**
   * Fire-and-forget, and best effort: a release is cancelled in the database
   * whether or not the agent hears about it, so an agent that is offline — or
   * never received the deployment — cannot keep the application blocked.
   */
  async cancelDeploy(releaseId: string): Promise<void> {
    await this.emit('deploy.cancel', new DeployCancelEvent(releaseId));
    this.logger.log(`Asked the agent to cancel release ${releaseId}`);
  }

  /**
   * A rendered stack is a few kilobytes. Anything near the cap means something
   * unintended is being shipped — an env file with a certificate pasted in, say
   * — and a silent truncation downstream would be far worse than a refusal.
   */
  private assertSendable(event: DeployCommandEvent, slug: string): void {
    const size = Buffer.byteLength(JSON.stringify(event), 'utf8');

    if (size > MAX_DEPLOY_MESSAGE_BYTES) {
      throw new BadRequestException(
        `Deployment payload for "${slug}" is ${Math.round(size / 1024)} KB, ` +
          `over the ${MAX_DEPLOY_MESSAGE_BYTES / 1024} KB limit. ` +
          'Move large files out of the stack directory.',
      );
    }
  }

  /**
   * Reads an adopted stack's compose files back, for conversion to RENDERED
   * (§8.5). Read-only and limited to the paths the agent itself reported.
   */
  async readStackFiles(stack: DiscoveredStack): Promise<StackFilesResult> {
    if (!stack.configFiles.length) {
      throw new BadRequestException(
        `Stack "${stack.project}" reports no compose files to read.`,
      );
    }

    this.assertAgentOnline();

    return this.withTimeout(
      this.send<StackFilesResult>(
        'stack.read-files',
        new StackReadFilesEvent(
          stack.project,
          stack.workingDir,
          stack.configFiles,
        ),
      ),
      ACTION_TIMEOUT_MS,
      `read files of "${stack.project}"`,
    );
  }

  /**
   * Asks the registry, through the agent, whether a newer image exists (§11.5).
   *
   * Read-only and safe to call on any stack, including TrueNAS-managed ones —
   * knowing an update exists is useful even where acting on it is not allowed.
   */
  async checkForUpdate(
    stack: DiscoveredStack,
    image: string,
  ): Promise<StackUpdateCheck> {
    this.assertAgentOnline();

    return this.withTimeout(
      this.send<StackUpdateCheck>(
        'stack.check-update',
        new StackCheckUpdateEvent(
          stack.project,
          stack.workingDir,
          stack.configFiles,
          image,
        ),
      ),
      LOGS_TIMEOUT_MS,
      `update check for "${stack.project}"`,
    );
  }

  /**
   * Every command is signed: the agent runs what arrives on its queue, so a
   * message from anyone else on the broker must not look like one from here.
   */
  private async emit(pattern: string, payload: object): Promise<void> {
    await this.outbound.emitToQueue(
      this.queue,
      pattern,
      signMessage(this.key, pattern, payload),
    );
  }

  private send<T>(pattern: string, payload: object): Promise<T> {
    return this.outbound.sendToQueue<T>(
      this.queue,
      pattern,
      signMessage(this.key, pattern, payload),
    );
  }

  /** I11 — origin decides what may be asked of a stack. */
  private assertAllowed(stack: DiscoveredStack, action: StackAction): void {
    if (assertActionAllowed(stack.origin, action)) return;

    throw new BadRequestException(
      `Action "${action}" is not allowed for stack "${stack.project}" ` +
        `(origin ${stack.origin}). Allowed: ${stack.allowedActions.join(', ')}.`,
    );
  }

  /**
   * Fails fast rather than letting the request sit until the timeout: if no
   * heartbeat has arrived the agent is not going to answer.
   */
  private assertAgentOnline(): void {
    if (this.health.health().online) return;

    throw new ServiceUnavailableException(
      'The deploy agent is offline; the host cannot be reached right now.',
    );
  }

  private async withTimeout<T>(
    work: Promise<T>,
    ms: number,
    description: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new GatewayTimeoutException(
              `The agent did not answer within ${ms / 1000}s (${description}).`,
            ),
          ),
        ms,
      );
    });

    try {
      return await Promise.race([work, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
