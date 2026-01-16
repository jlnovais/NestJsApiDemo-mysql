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

function getBool(config: ConfigService, key: string, defaultValue = false) {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  return raw.toLowerCase() === 'true';
}

function getNum(config: ConfigService, key: string, defaultValue: number) {
  const raw = config.get<string | number>(key);
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getStr(config: ConfigService, key: string, defaultValue?: string) {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  return raw;
}

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
        const hostname =
          getStr(config, 'RABBITMQ_HOST') ||
          getStr(config, 'RABBITMQ_HOST_SENDER') ||
          '';

        const details: RabbitMqConnectionDetailsSender = {
          hostname,
          port: getNum(
            config,
            'RABBITMQ_PORT',
            getNum(config, 'RABBITMQ_PORT_SENDER', 5672),
          ),
          username:
            getStr(config, 'RABBITMQ_USER') ||
            getStr(config, 'RABBITMQ_USER_SENDER'),
          password:
            getStr(config, 'RABBITMQ_PASSWORD') ||
            getStr(config, 'RABBITMQ_PASSWORD_SENDER'),
          vhost:
            getStr(config, 'RABBITMQ_VHOST') ||
            getStr(config, 'RABBITMQ_VHOST_SENDER'),
          connectionDescription:
            getStr(config, 'RABBITMQ_CONNECTION_DESCRIPTION') ||
            getStr(config, 'RABBITMQ_CONNECTION_DESCRIPTION_SENDER'),
          connectionTimeout: getNum(
            config,
            'RABBITMQ_CONNECTION_TIMEOUT',
            getNum(config, 'RABBITMQ_CONNECTION_TIMEOUT_SENDER', 10000),
          ),
          selectRandomHost: getBool(
            config,
            'RABBITMQ_SELECT_RANDOM_HOST',
            getBool(config, 'RABBITMQ_SELECT_RANDOM_HOST_SENDER', true),
          ),
          selectSequencialHost: getBool(
            config,
            'RABBITMQ_SELECT_SEQUENCIAL_HOST',
            getBool(config, 'RABBITMQ_SELECT_SEQUENCIAL_HOST_SENDER', false),
          ),
          connectionRetryDelay: getNum(
            config,
            'RABBITMQ_CONNECTION_RETRY_DELAY',
            getNum(config, 'RABBITMQ_CONNECTION_RETRY_DELAY_SENDER', 5000),
          ),
          connectionRetryAttempts: getNum(
            config,
            'RABBITMQ_CONNECTION_RETRY_ATTEMPTS',
            getNum(config, 'RABBITMQ_CONNECTION_RETRY_ATTEMPTS_SENDER', 10),
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
        const hostname =
          getStr(config, 'RABBITMQ_HOST_CONSUMER') ||
          getStr(config, 'RABBITMQ_HOST') ||
          '';

        const details: RabbitMqConnectionDetailsConsumer = {
          hostname,
          port: getNum(
            config,
            'RABBITMQ_PORT_CONSUMER',
            getNum(config, 'RABBITMQ_PORT', 5672),
          ),
          username:
            getStr(config, 'RABBITMQ_USER_CONSUMER') ||
            getStr(config, 'RABBITMQ_USER'),
          password:
            getStr(config, 'RABBITMQ_PASSWORD_CONSUMER') ||
            getStr(config, 'RABBITMQ_PASSWORD'),
          vhost:
            getStr(config, 'RABBITMQ_VHOST_CONSUMER') ||
            getStr(config, 'RABBITMQ_VHOST'),
          connectionDescription:
            getStr(config, 'RABBITMQ_CONNECTION_DESCRIPTION_CONSUMER') ||
            getStr(config, 'RABBITMQ_CONNECTION_DESCRIPTION'),
          connectionTimeout: getNum(
            config,
            'RABBITMQ_CONNECTION_TIMEOUT_CONSUMER',
            getNum(config, 'RABBITMQ_CONNECTION_TIMEOUT', 10000),
          ),
          maxChannelsPerConnection: getNum(
            config,
            'RABBITMQ_MAX_CHANNELS_PER_CONNECTION',
            3,
          ),
          useRetryCountForRequedMessages: getBool(
            config,
            'RABBITMQ_USE_RETRY_COUNT_FOR_REQUED_MESSAGES',
            false,
          ),
          messageRetryTTLInSecondsMin: getNum(
            config,
            'RABBITMQ_RETRY_QUEUE_MESSAGE_TTL_IN_SECONDS_MIN',
            0,
          ),
          messageRetryTTLInSecondsMax: getNum(
            config,
            'RABBITMQ_RETRY_QUEUE_MESSAGE_TTL_IN_SECONDS_MAX',
            0,
          ),
          retryQueue: getStr(config, 'RABBITMQ_RETRY_QUEUE'),
        };

        return new RabbitMQConsumerService(details, loggerWrapper);
      },
    },
  ],
  exports: [RabbitMqSenderService, RabbitMQConsumerService],
})
export class RabbiMQModule {}
