import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private clients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    const clientId = client.id;
    this.clients.set(clientId, client);
    Logger.log(`Client connected with ID ${clientId}`);
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    this.clients.delete(clientId);
    Logger.log(`Client disconnected with ID ${clientId}`);
  }

  sendMessageToClient(clientId: string, message: string, data?: Object) {
    const client = this.clients.get(clientId);
    if (client) {
      client.emit(message, data);
    } else {
      Logger.log(`Client with ID ${clientId} not found.`);
    }
  }

  sendToAll(message: string, data?: Object) {
    this.clients.forEach((client) => {
      client.emit(message, data);
    });
  }
}
