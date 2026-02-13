import { Injectable } from '@nestjs/common';
import { SocketIoGateway } from './socket-io.gateway';
import { Socket } from 'socket.io';

@Injectable()
export class SocketIoService {
  constructor(private readonly gateway: SocketIoGateway) {}

  getClientCount(): number {
    return this.gateway.server.sockets.size;
  }

  getClient(id: string): Socket | undefined {
    return this.gateway.server.sockets.get(id);
  }

  getClients(): Socket[] {
    return Array.from(this.gateway.server.sockets.values());
  }

  emitToAll(event: string, eventType: string, data: unknown): void {
    this.gateway.server.emit(event, JSON.stringify({ event, eventType, data }));
  }
}
