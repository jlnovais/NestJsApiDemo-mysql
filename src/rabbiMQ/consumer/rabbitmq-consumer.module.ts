import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MyLoggerModule } from '../../my-logger/my-logger.module';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import {
  LoggerWrapper,
  RabbitMqConnectionDetailsConsumer,
} from '../commom/types';
import {
  RABBITMQ_CONSUMER_OPTIONS,
  RABBITMQ_LOGGER_WRAPPER,
} from '../rabbitmq.tokens';
import { RabbitMQConsumerService } from './rabbitMQConsumer.service';

@Module({
  imports: [ConfigModule, MyLoggerModule],
  providers: [
    {
      provide: RABBITMQ_LOGGER_WRAPPER,
      inject: [MyLoggerService],
      useFactory: (logger: MyLoggerService): LoggerWrapper => {
        const context = 'RabbitMQ';
        return {
          info: (message: string) => logger.log(message, context),
          warn: (message: string) => logger.warn(message, context),
          error: (message: string, error?: Error) =>
            logger.error(message, error?.stack ?? context),
        };
      },
    },
    {
      provide: RABBITMQ_CONSUMER_OPTIONS,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService,
      ): RabbitMqConnectionDetailsConsumer => {
        const hostname = config.get<string>('RABBITMQ_HOST_CONSUMER') ?? '';

        return {
          hostname,
          port: config.get<number>('RABBITMQ_PORT_CONSUMER', 5672),
          username: config.get<string>('RABBITMQ_USER_CONSUMER'),
          password: config.get<string>('RABBITMQ_PASSWORD_CONSUMER'),
          vhost: config.get<string>('RABBITMQ_VHOST_CONSUMER'),
          connectionDescription: config.get<string>(
            'RABBITMQ_CONNECTION_DESCRIPTION_CONSUMER',
          ),
          connectionTimeout: config.get<number>(
            'RABBITMQ_CONNECTION_TIMEOUT_CONSUMER',
            10000,
          ),
          maxChannelsPerConnection: config.get<number>(
            'RABBITMQ_MAX_CHANNELS_PER_CONNECTION',
            3,
          ),
          useRetryCountForRequedMessages: config.get<boolean>(
            'RABBITMQ_USE_RETRY_COUNT_FOR_REQUED_MESSAGES',
            false,
          ),
          messageRetryTTLInSecondsMin: config.get<number>(
            'RABBITMQ_RETRY_QUEUE_MESSAGE_TTL_IN_SECONDS_MIN',
            0,
          ),
          messageRetryTTLInSecondsMax: config.get<number>(
            'RABBITMQ_RETRY_QUEUE_MESSAGE_TTL_IN_SECONDS_MAX',
            0,
          ),
          retryQueue: config.get<string>('RABBITMQ_RETRY_QUEUE'),
        };
      },
    },
    RabbitMQConsumerService,
  ],
  exports: [RabbitMQConsumerService],
})
export class RabbitMQConsumerModule {}
