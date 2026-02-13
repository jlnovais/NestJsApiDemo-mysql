import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { WsAppModule } from './ws-app.module';

/**
 * Bootstrap the native WebSocket server on a separate port.
 * Call this after the main app is running to have both Socket.IO and ws available.
 */
export async function bootstrapWs(): Promise<void> {
  const wsPort = parseInt(process.env.WS_PORT || '3001', 10);

  const app = await NestFactory.create(WsAppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(wsPort);
  console.log(
    `Native WebSocket server is running on: ws://localhost:${wsPort}/ws-demo`,
  );
}
