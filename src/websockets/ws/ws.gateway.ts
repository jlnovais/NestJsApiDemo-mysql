import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';

/** WebSocket.OPEN = 1. Sends only when connection is open. */
function sendIfOpen(ws: WebSocket, message: string): void {
  // ws package types trigger no-unsafe-*; runtime type is correct
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  if (ws.readyState === 1) ws.send(message);
}

@WebSocketGateway({
  path: '/ws-demo',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private clients = new Set<WebSocket>();

  handleConnection(client: WebSocket) {
    this.clients.add(client);
    console.log('[WS] Client connected, total:', this.clients.size);
  }

  handleDisconnect(client: WebSocket) {
    this.clients.delete(client);
    console.log('[WS] Client disconnected, total:', this.clients.size);
  }

  private broadcast(event: string, data: unknown) {
    const message = JSON.stringify({ event, data });
    for (const client of this.clients) {
      sendIfOpen(client, message);
    }
  }

  @SubscribeMessage('echo')
  onEcho(@MessageBody() message: string) {
    console.log('[WS] echo message:', message);
    this.broadcast('echo', 'echo: ' + message);
    return { ok: true };
  }

  @SubscribeMessage('message')
  onMessage(@MessageBody() message: string) {
    console.log('[WS] message:', message);
    this.broadcast('message', 'message: ' + message);
    return { ok: true };
  }

  @SubscribeMessage('time')
  onTime(@MessageBody() message: string, @ConnectedSocket() client: WebSocket) {
    console.log('[WS] time message:', message);
    const time = new Date().toISOString();
    const response = 'your message is: ' + message + ' at ' + time;
    sendIfOpen(client, JSON.stringify({ event: 'time', data: response }));
    return { ok: true };
  }
}
