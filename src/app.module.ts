import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MyLoggerModule } from './my-logger/my-logger.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { DatabaseContextInterceptor } from './database/database-context.interceptor';
import { RabbitMQConsumerModule } from './rabbiMQ/consumer/rabbitmq-consumer.module';
import { RabbitMQSenderModule } from './rabbiMQ/sender/rabbitmq-sender.module';
import { validateEnv } from './config/validate-env';
import { RabbitMqClientModule } from './rabbitMqClient/rabbitMqClient.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    RabbitMqClientModule,

    RedisModule,
    UsersModule,
    DatabaseModule,
    EmployeesModule,
    AuthModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    MyLoggerModule,
    RabbitMQSenderModule,
    RabbitMQConsumerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DatabaseContextInterceptor,
    },
  ],
})
export class AppModule {}
