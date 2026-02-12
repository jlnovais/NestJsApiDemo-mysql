import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

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
  server!: Server;

  handleConnection() {
    // no-op for now
    console.log('Client connected');
  }

  handleDisconnect() {
    // no-op for now
    console.log('Client disconnected');
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
