import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WsModule } from './ws.module';

/**
 * Minimal app module for the native WebSocket server.
 * Used when bootstrapping the ws-only Nest app on a separate port.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WsModule,
  ],
})
export class WsAppModule {}
