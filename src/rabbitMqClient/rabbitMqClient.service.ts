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
  ConnectionClosedDelegate,
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

    this.rabbitMqConsumerService.onConnectionClosed = this.connectionClosed;
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

  private reconnectTimer?: ReturnType<typeof setTimeout>;

  private reconnectInterval?: ReturnType<typeof setInterval>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private readonly reconnectDelay = 10 * 1000; // 10 seconds

  private readonly connectionClosed: ConnectionClosedDelegate = (
    hostname,
    removedCount,
    totalRunning,
  ) => {
    /*
    Reconnect configuration:
    - 0  => disabled
    - -1 => infinite retries
    - >0 => max retry attempts
    */
    this.maxReconnectAttempts = this.configService.get<number>(
      'RABBITMQ_CONSUMER_MAX_RECONNECT_ATTEMPTS',
      0,
    );

    this.logger.log(
      `[RabbitMqClientService] Connection closed: ${hostname}. Removed count: ${removedCount}. Total running: ${totalRunning}`,
    );

    if (this.maxReconnectAttempts === 0) {
      this.logger.log(
        'Max reconnect attempts is 0; No reconnect attempts will be made.',
      );
      return;
    }
    if (this.maxReconnectAttempts < 0) {
      this.logger.log(
        'Max reconnect attempts is less than 0; Infinite reconnect attempts will be made.',
      );
    }

    this.reconnectAttempts = 0;

    this.reconnectInterval = setInterval(() => {
      if (this.maxReconnectAttempts > 0) this.reconnectAttempts += 1;

      this.startConsumers()
        .then(() => {
          // success => stop retry loop
          if (this.reconnectInterval) clearInterval(this.reconnectInterval);
          this.reconnectInterval = undefined;
          this.reconnectAttempts = 0;
          this.logger.log('Reconnect successful; stopped retry loop');
        })
        .catch((err: unknown) => {
          const stack = err instanceof Error ? err.stack : undefined;

          const errorMessage =
            this.maxReconnectAttempts > 0
              ? `Reconnect attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts} failed`
              : 'Reconnect attempt failed; Infinite reconnect attempts will be made.';
          this.logger.error(
            errorMessage,
            this.reconnectAttempts,
            this.maxReconnectAttempts,
            stack ?? String(err),
          );
        });

      if (
        this.reconnectAttempts >= this.maxReconnectAttempts &&
        this.maxReconnectAttempts > 0
      ) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = undefined;
        this.reconnectAttempts = 0;
        this.logger.log('Reconnect stopped; reached max reconnect attempts');
      }
    }, this.reconnectDelay);
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

    await this.startConsumers();
  }

  private async startConsumers() {
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
