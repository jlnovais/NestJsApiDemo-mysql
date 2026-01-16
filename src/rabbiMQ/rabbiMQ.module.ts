import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MyLoggerModule } from '../my-logger/my-logger.module';
import { MyLoggerService } from '../my-logger/my-logger.service';
import {
  LoggerWrapper,
  RabbitMqConnectionDetailsConsumer,
  RabbitMqConnectionDetailsSender,
} from './commom/types';
import { RabbitMQConsumerService } from './consumer/rabbitMQConsumer.service';
import { RabbitMqSenderService } from './sender/rabbitMqSender.service';

const RABBITMQ_LOGGER_WRAPPER = 'RABBITMQ_LOGGER_WRAPPER';

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
      provide: RabbitMqSenderService,
      inject: [ConfigService, RABBITMQ_LOGGER_WRAPPER],
      useFactory: (
        config: ConfigService,
        loggerWrapper: LoggerWrapper,
      ): RabbitMqSenderService => {
        const hostname = config.get<string>('RABBITMQ_HOST_SENDER') ?? '';

        const details: RabbitMqConnectionDetailsSender = {
          hostname,
          port: config.get<number>('RABBITMQ_PORT_SENDER', 5672),
          username: config.get<string>('RABBITMQ_USER_SENDER'),
          password: config.get<string>('RABBITMQ_PASSWORD_SENDER'),
          vhost: config.get<string>('RABBITMQ_VHOST_SENDER'),
          connectionDescription: config.get<string>(
            'RABBITMQ_CONNECTION_DESCRIPTION_SENDER',
          ),
          connectionTimeout: config.get<number>(
            'RABBITMQ_CONNECTION_TIMEOUT',
            10000,
          ),
          selectRandomHost: config.get<boolean>(
            'RABBITMQ_SELECT_RANDOM_HOST',
            true,
          ),
          selectSequencialHost: config.get<boolean>(
            'RABBITMQ_SELECT_SEQUENCIAL_HOST',
            false,
          ),
          connectionRetryDelay: config.get<number>(
            'RABBITMQ_CONNECTION_RETRY_DELAY',
            5000,
          ),
          connectionRetryAttempts: config.get<number>(
            'RABBITMQ_CONNECTION_RETRY_ATTEMPTS',
            10,
          ),
        };

        return new RabbitMqSenderService(details, loggerWrapper);
      },
    },
    {
      provide: RabbitMQConsumerService,
      inject: [ConfigService, RABBITMQ_LOGGER_WRAPPER],
      useFactory: (
        config: ConfigService,
        loggerWrapper: LoggerWrapper,
      ): RabbitMQConsumerService => {
        const hostname = config.get<string>('RABBITMQ_HOST_CONSUMER') ?? '';

        const details: RabbitMqConnectionDetailsConsumer = {
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

        return new RabbitMQConsumerService(details, loggerWrapper);
      },
    },
  ],
  exports: [RabbitMqSenderService, RabbitMQConsumerService],
})
export class RabbiMQModule {}
