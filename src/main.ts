import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import session from 'express-session';
import { RedisService } from './redis/redis.service';
import { RedisStore } from 'connect-redis';

async function bootstrap() {
  // usar os custom logger globalmente:
  //
  //const app = await NestFactory.create(AppModule, {
  //  bufferLogs: true,
  //});
  //app.useLogger(app.get('MyLoggerService'));

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // alternativa ao const configService = app.get(ConfigService); - usar directamente o process.env que é um objeto global do node.js
  //const port = parseInt(process.env.PORT || '3000', 10);

  // tratamento custom de excepções
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  app.enableCors({
    origin: true, // Allow all origins in development, configure properly for production
    credentials: true, // Allow cookies to be sent
  });
  app.setGlobalPrefix('api');

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Nest API Demo')
    .setDescription(
      'A comprehensive REST API built with NestJS and MySQL. This API provides endpoints for managing users, employees, and departments with role-based access control.',
    )
    .setVersion('1.0')
    .setContact('API Support', 'https://example.com', 'support@example.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer(`http://localhost:${port}`, 'Development server')
    .addTag(
      'users',
      'User management endpoints - CRUD operations for user entities',
    )
    .addTag(
      'employees',
      'Employee management endpoints - CRUD operations for employee entities with database persistence',
    )
    .addTag(
      'departments',
      'Department management endpoints - CRUD operations for department entities',
    )
    .addTag(
      'app',
      'Application endpoints - Health check and general information',
    )
    .addTag(
      'auth',
      'Authentication endpoints - Login, verification, and session management',
    )
    .addCookieAuth('session-id')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Initialize Redis manually before setting up sessions
  const redisService = app.get(RedisService);
  const redisEnabled = configService.get<boolean>('REDIS_ENABLED', false);

  let sessionStore: session.Store | undefined;

  if (redisEnabled) {
    // Manually initialize Redis connection before setting up sessions
    await redisService.initialize();

    if (redisService.isAvailable()) {
      try {
        const redisClient = redisService.getClient();
        if (redisClient) {
          sessionStore = new RedisStore({
            client: redisClient,
            prefix: 'sess:',
          });
          console.log('✓ Using Redis store for sessions');
        }
      } catch (error) {
        console.error(
          'Failed to setup Redis store:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  if (!sessionStore) {
    sessionStore = new session.MemoryStore();
    console.log('✓ Using in-memory store for sessions');
  }

  const sessionSecret =
    configService.get<string>('SESSION_SECRET') ||
    'your-secret-key-change-in-production';

  const maxAge =
    configService.get<number>('SESSION_EXPIRY_MINUTES', 5) * 60 * 1000; // convert minutes to milliseconds

  // Set up session middleware BEFORE routes are registered
  app.use(
    session({
      store: sessionStore,
      name: 'session-id',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: configService.get<string>('NODE_ENV') === 'production',
        httpOnly: true,
        maxAge: maxAge,
        sameSite: 'lax',
      },
    }),
  );

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}
bootstrap().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});
