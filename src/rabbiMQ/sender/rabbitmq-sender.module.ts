import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MyLoggerModule } from '../../my-logger/my-logger.module';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import {
  LoggerWrapper,
  RabbitMqConnectionDetailsSender,
} from '../commom/types';
import {
  RABBITMQ_LOGGER_WRAPPER,
  RABBITMQ_SENDER_OPTIONS,
} from '../rabbitmq.tokens';
import { RabbitMqSenderService } from './rabbitMqSender.service';

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
      provide: RABBITMQ_SENDER_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RabbitMqConnectionDetailsSender => {
        const hostname = config.get<string>('RABBITMQ_HOST_SENDER') ?? '';

        return {
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
      },
    },
    RabbitMqSenderService,
  ],
  exports: [RabbitMqSenderService],
})
export class RabbitMQSenderModule {}
