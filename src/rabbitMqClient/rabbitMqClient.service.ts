import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type amqplib from 'amqplib';
import { RabbitMQConsumerService } from 'src/rabbiMQ/consumer/rabbitMQConsumer.service';
import {
  MessageProcessInstruction,
  type MessageProcessInstructionType,
  type ReceiveMessageDelegate,
  type ReceiveMessageErrorDelegate,
  type ShutdownDelegate,
} from 'src/rabbiMQ/consumer/rabbitMQConsumer.types';

@Injectable()
export class RabbitMqClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rabbitMqConsumerService: RabbitMQConsumerService,
  ) {
    this.rabbitMqConsumerService.onMessageReceived = this.receiveMessage;

    this.rabbitMqConsumerService.onConsumerShutdown = this.shutdownConsumer;
    this.rabbitMqConsumerService.onProcessingError = this.processError;
  }

  private isConsumerEnabled(): boolean {
    return this.configService.get<boolean>('RABBITMQ_CONSUMER_ENABLED', false);
  }

  private readonly shutdownConsumer: ShutdownDelegate = (consumerTag: string) =>
    this.logger.log(`Consumer shutdown: ${consumerTag}`);

  private readonly processError: ReceiveMessageErrorDelegate = (
    error: Error,
    consumerTag: string,
    message: amqplib.ConsumeMessage,
  ) => {
    this.logger.error(
      `Processing error (consumer: ${consumerTag}): ${error.message}`,
      error.stack,
      { message },
    );
  };

  private readonly receiveMessage: ReceiveMessageDelegate = (
    messageObject,
    messageContent,
    consumerName,
    firstRetryDate,
    lastRetryDate,
    elapsedTimeInSeconds,
    retryCount,
  ): Promise<MessageProcessInstructionType> => {
    this.logger.log(`Received message (consumer: ${consumerName})`, {
      firstRetryDate,
      lastRetryDate,
      elapsedTimeInSeconds,
      retryCount,
    });
    this.logger.debug(`Message content: ${messageContent}`);
    this.logger.debug(
      `Message headers: ${JSON.stringify(messageObject.properties.headers ?? {})}`,
    );

    if (messageContent.toLowerCase().includes('error')) {
      this.logger.error(`Error message received!!`);
      return Promise.resolve(MessageProcessInstruction.IgnoreMessage);
    }

    return Promise.resolve(MessageProcessInstruction.OK);
  };

  async onModuleInit() {
    if (!this.isConsumerEnabled()) {
      this.logger.log('Consumers are not enabled');
      return;
    }
    this.logger.log('Starting consumers...');
    const consumerName: string = this.configService.get<string>(
      'RABBITMQ_CONNECTION_DESCRIPTION_CONSUMER',
      'test-consumer',
    );

    const queueName: string = this.configService.get<string>(
      'RABBITMQ_USER_QUEUE_CONSUMER',
      '',
    );
    const totalConsumers: number = this.configService.get<number>(
      'RABBITMQ_CONSUMER_INSTANCES_TO_START',
      1,
    );

    await this.rabbitMqConsumerService.startConsumers(
      consumerName,
      queueName,
      totalConsumers,
    );
  }

  async onModuleDestroy() {
    if (!this.isConsumerEnabled()) {
      return;
    }
    this.logger.log('Stopping consumers...');

    if (this.rabbitMqConsumerService.TotalRunningConsumers > 0) {
      this.logger.log('Stopping consumers...');
      await this.rabbitMqConsumerService.stopAllConsumers();
      this.logger.log('Consumers stopped');
    } else {
      this.logger.log('No consumers to stop');
    }
  }
}
