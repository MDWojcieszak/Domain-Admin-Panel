import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
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
    const client = this.getOrCreateClient(queueName);

    client.emit(pattern, payload);
  }

  async sendToServer<TResponse = any, TPayload = any>(
    serverName: string,
    pattern: string,
    payload: TPayload,
  ): Promise<TResponse> {
    const queueName = await this.getServerQueueNameOrThrow(serverName);
    const client = this.getOrCreateClient(queueName);

    return await firstValueFrom(client.send<TResponse>(pattern, payload));
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
