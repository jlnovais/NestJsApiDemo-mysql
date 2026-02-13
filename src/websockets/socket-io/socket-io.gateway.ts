import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';

@WebSocketGateway({
  path: '/my-demo',
  namespace: '/socket-io-demo',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class SocketIoGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Namespace;

  handleConnection() {
    const count = this.server.sockets.size;
    console.log('Client connected. Total clients:', count);
  }

  handleDisconnect() {
    const count = this.server.sockets.size;
    console.log('Client disconnected. Total clients:', count);
  }

  @SubscribeMessage('echo')
  onEcho(@MessageBody() message: string, @ConnectedSocket() client: Socket) {
    console.log('echo message: ' + message + ' from client: ' + client.id);
    // Broadcast to ALL clients (including sender)
    this.server.emit('echo', 'echo: ' + message);

    // Optional ack response to the sender
    return { ok: true };
  }

  @SubscribeMessage('message')
  onMessage(@MessageBody() message: string, @ConnectedSocket() client: Socket) {
    // Broadcast to ALL clients (including sender)
    console.log('message message: ' + message + ' from client: ' + client.id);
    this.server.emit('message', 'message: ' + message);

    // Optional ack response to the sender
    return { ok: true };
  }

  @SubscribeMessage('time')
  onTime(@MessageBody() message: string, @ConnectedSocket() client: Socket) {
    // Broadcast to ALL clients (including sender)
    console.log('time message: ' + message + ' from client: ' + client.id);

    const time = new Date().toISOString();
    client.emit('time', 'your message is: ' + message + ' at ' + time);

    // Optional ack response to the sender
    return { ok: true };
  }
}
