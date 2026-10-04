import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServerOutboundMessagingService {
  private readonly logger = new Logger(ServerOutboundMessagingService.name);

  private readonly clients = new Map<string, ClientProxy>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getRabbitUrl(): string {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) throw new Error('RABBITMQ_URL is not configured');
    return url;
  }

  private getOrCreateClient(queueName: string): ClientProxy {
    const cached = this.clients.get(queueName);
    if (cached) return cached;

    const rabbitUrl = this.getRabbitUrl();

    const client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitUrl],
        queue: queueName,
        queueOptions: {
          durable: true,
        },
      },
    });

    this.clients.set(queueName, client);
    this.logger.log(`Created outbound client for queue: ${queueName}`);
    return client;
  }

  private async getServerQueueNameOrThrow(serverName: string): Promise<string> {
    const server = await this.prisma.server.findUnique({
      where: { name: serverName },
      select: { queueName: true },
    });

    const queueName = server?.queueName ?? null;
    if (!queueName) {
      throw new Error(
        `Server "${serverName}" has no queueName (not registered or missing field)`,
      );
    }

    return queueName;
  }

  async emitToServer(
    serverName: string,
    pattern: string,
    payload: any,
  ): Promise<void> {
    const queueName = await this.getServerQueueNameOrThrow(serverName);

    // Fire-and-forget for its callers, several of which do not await it — a
    // rejection here would be an unhandled one. A failure is logged instead
    // of vanishing, which is what used to happen.
    try {
      await this.publish(queueName, (client) => client.emit(pattern, payload));
    } catch (error) {
      this.logger.error(
        `Could not send "${pattern}" to ${serverName}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async sendToServer<TResponse = any, TPayload = any>(
    serverName: string,
    pattern: string,
    payload: TPayload,
  ): Promise<TResponse> {
    const queueName = await this.getServerQueueNameOrThrow(serverName);
    return this.publish(queueName, (client) =>
      client.send<TResponse>(pattern, payload),
    );
  }

  /** For a consumer with a fixed queue, not a registered server (the deploy agent). */
  async emitToQueue(
    queueName: string,
    pattern: string,
    payload: unknown,
  ): Promise<void> {
    await this.publish(queueName, (client) => client.emit(pattern, payload));
  }

  async sendToQueue<TResponse = any>(
    queueName: string,
    pattern: string,
    payload: unknown,
  ): Promise<TResponse> {
    return this.publish(queueName, (client) =>
      client.send<TResponse>(pattern, payload),
    );
  }

  /**
   * Publishes through the cached client, replacing it once if it cannot
   * connect.
   *
   * A Nest RMQ client remembers a failed first connection for good: created
   * while the broker is still starting (the backend and RabbitMQ restart
   * together), every later message fails on it — and an `emit` nobody
   * subscribes to fails silently. Dropping the client lets the next attempt
   * connect afresh. Only connection failures are retried: nothing was sent,
   * so a retry cannot deliver a command twice.
   */
  private async publish<T>(
    queueName: string,
    op: (client: ClientProxy) => Observable<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await firstValueFrom(op(this.getOrCreateClient(queueName)), {
          defaultValue: undefined as T,
        });
      } catch (error) {
        if (!isConnectionError(error)) throw error;

        this.dropClient(queueName);
        if (attempt >= 2) throw error;
        this.logger.warn(
          `Reconnecting the outbound client for ${queueName}: ${
            (error as Error).message
          }`,
        );
      }
    }
  }

  private dropClient(queueName: string): void {
    const client = this.clients.get(queueName);
    this.clients.delete(queueName);
    try {
      client?.close();
    } catch {
      // Already broken; nothing to close.
    }
  }

  async invalidateServer(serverName: string): Promise<void> {
    return this.prisma.server
      .findUnique({
        where: { name: serverName },
        select: { queueName: true },
      })
      .then((server) => {
        const queueName = server?.queueName;
        if (queueName && this.clients.has(queueName)) {
          this.clients.delete(queueName);
          this.logger.log(
            `Invalidated outbound client cache for queue: ${queueName}`,
          );
        }
      });
  }
}

const CONNECTION_ERRORS = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'EPIPE',
]);

/** The broker could not be reached — as opposed to an error the receiver sent back. */
const isConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return (
    (code !== undefined && CONNECTION_ERRORS.has(code)) ||
    /connect|disconnected|channel closed|connection closed/i.test(error.message)
  );
};
