import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';

import { PermissionsService } from '../common/acl/permissions.service';
import { PERMISSIONS } from '../common/acl/permissions';

export enum WsRoom {
  SERVERS = 'servers',
  PROCESSES = 'processes',
  COMMANDS = 'commands',
}

@WebSocketGateway({ cors: true })
export class WebsocketGateway implements OnGatewayConnection {
  private readonly logger = new Logger(WebsocketGateway.name);

  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get('JWT_SECRET'),
      });

      client.data.user = payload;

      const isOwner = payload.role === Role.OWNER;
      const permissions = isOwner
        ? null
        : await this.permissionsService.getEffectivePermissions(payload.sub);

      const can = (permission: string) =>
        isOwner || !!permissions?.has(permission);

      if (can(PERMISSIONS.SERVER_READ)) client.join(WsRoom.SERVERS);
      if (can(PERMISSIONS.PROCESS_READ)) client.join(WsRoom.PROCESSES);
      if (can(PERMISSIONS.COMMAND_READ)) client.join(WsRoom.COMMANDS);
    } catch {
      this.logger.warn(`Rejected socket ${client.id}: invalid token`);
      client.disconnect();
    }
  }

  emitToRoom(room: WsRoom, event: string, data?: unknown): void {
    this.server.to(room).emit(event, data);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }

    return undefined;
  }
}
