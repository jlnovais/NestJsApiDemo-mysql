import amqplib from 'amqplib';
import {
  //ConsumerServiceConfig,
  //RabbitMQConfig,
  MessageProcessInstruction,
  ReceiveMessageDelegate,
  ShutdownDelegate,
  ReceiveMessageErrorDelegate,
} from './rabbitMQConsumer.types';
import {
  LoggerWrapper,
  RabbitMqConnectionDetailsConsumer,
} from '../commom/types';
import { WriteLog } from '../commom/utils';

const RETRY_COUNT_HEADER = 'x-jn-retry-count';
const FIRST_REQUEUE_TIMESTAMP_HEADER = 'x-jn-first-requeued-at';
const REQUEUE_TIMESTAMP_HEADER = 'x-jn-requeued-at';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDateHeader(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return undefined;
}

interface RunningConsumer {
  channel: amqplib.Channel;
  consumerTag: string; // The tag returned by RabbitMQ
  connectionWrapper: ConnectionWrapper;
}

interface ConnectionWrapper {
  connection: amqplib.ChannelModel;
  channelCount: number;
  hostname: string | undefined;
  id: number;
}

export class RabbitMQConsumerService {
  //private readonly configs: RabbitMQConfig[] = [];

  private _logger: LoggerWrapper | null = null;
  private readonly configs: amqplib.Options.Connect[] = [];

  private maxChannelsPerConnection: number = 3;
  private connections: ConnectionWrapper[] = [];
  private consumers: Map<string, RunningConsumer> = new Map(); // Keyed by internally generated tag

  private connectionDescription: string | undefined;
  private connectionTimeout?: number;

  private useRetryCountForRequedMessages: boolean = false;

  private retryQueue: string | undefined = undefined; // Optional retry queue name, if needed

  private messageRetryTTLInSecondsMin: number = 0; // Default to 0, meaning no delay
  private messageRetryTTLInSecondsMax: number = 0;

  // Delegates to be implemented by the user of this class
  public onMessageReceived: ReceiveMessageDelegate = () =>
    Promise.resolve(MessageProcessInstruction.IgnoreMessage);
  public onConsumerShutdown: ShutdownDelegate = () => {};
  public onProcessingError: ReceiveMessageErrorDelegate = () => {};

  constructor(
    config: RabbitMqConnectionDetailsConsumer,
    logger: LoggerWrapper | null = null,
  ) {
    this._logger = logger;

    this.validateConfig(config);

    this.configs = config.hostname
      .replaceAll(' ', '')
      .replaceAll(';', ',')
      .split(',')
      .map((host) => ({
        protocol: 'amqp',
        hostname: host,
        port: config.port ?? 5672,
        username: config.username,
        password: config.password,
        vhost: config.vhost,
      }));

    //console.log("CONFIGS:", this.configs);

    this.retryQueue = config.retryQueue;

    this.useRetryCountForRequedMessages =
      config.useRetryCountForRequedMessages ?? false;

    this.connectionDescription = config.connectionDescription;
    this.connectionTimeout = config.connectionTimeout;

    console.info(
      'SETUP: messageRetryTTLInSecondsMin:',
      this.messageRetryTTLInSecondsMin,
    );
    console.info(
      'SETUP: messageRetryTTLInSecondsMax:',
      this.messageRetryTTLInSecondsMax,
    );
    console.info('SETUP: retryQueue:', this.retryQueue);
  }

  private _getRandomNumberInRange(min: number, max: number): number {
    let minValue = Math.min(min, max);
    const maxValue = Math.max(min, max);

    if (minValue === 0 && maxValue > 0) {
      minValue = 1; // Avoid zero if min is 0 and max is greater than 0
    }

    return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
  }

  private validateConfig(config: RabbitMqConnectionDetailsConsumer) {
    if (!config.hostname || config.hostname.trim() === '') {
      throw new Error(
        'Configuration error: hostname must be provided and cannot be empty.',
      );
    }

    this.maxChannelsPerConnection = config.maxChannelsPerConnection ?? 3;
    if (this.maxChannelsPerConnection <= 0) {
      this.maxChannelsPerConnection = 3; // Default to 3 if not specified or invalid
    }

    this.messageRetryTTLInSecondsMin = config.messageRetryTTLInSecondsMin ?? 0; // Default to 0 if not specified
    if (this.messageRetryTTLInSecondsMin < 0) {
      this.messageRetryTTLInSecondsMin = 0; // Ensure non-negative
    }

    this.messageRetryTTLInSecondsMax = config.messageRetryTTLInSecondsMax ?? 0; // Default to 0 if not specified
    if (this.messageRetryTTLInSecondsMax < 0) {
      this.messageRetryTTLInSecondsMax = 0; // Ensure non-negative
    }
  }

  public get TotalRunningConsumers(): number {
    return this.consumers.size;
  }

  public get TotalRunningConnections(): number {
    return this.connections.length;
  }

  public async startConsumers(
    consumerName: string,
    queueName: string,
    totalConsumers: number,
  ): Promise<void> {
    for (let i = 0; i < totalConsumers; i++) {
      const internalConsumerTag = `${consumerName}_${i}`;
      if (this.consumers.has(internalConsumerTag)) {
        WriteLog(
          this._logger,
          'warn',
          `Consumer with tag ${internalConsumerTag} is already running.`,
          { writeToConsole: true },
        );
        continue;
      }

      const { channel, connectionWrapper } = await this.getOrCreateChannel();

      //await channel.assertQueue(queueName, { durable: true });

      const { consumerTag: actualConsumerTag } = await channel.consume(
        queueName,
        (msg: amqplib.ConsumeMessage | null) => {
          void (async () => {
            if (msg === null) {
              // This is called when the consumer is cancelled
              await this.handleShutdown(internalConsumerTag);
              return;
            }

            try {
              // Extract and parse retry-related headers.
              const rawHeaders = msg.properties.headers as unknown;
              const headers: Record<string, unknown> = isRecord(rawHeaders)
                ? rawHeaders
                : {};

              const lastRetryDate = parseDateHeader(
                headers[REQUEUE_TIMESTAMP_HEADER],
              );
              const firstRetryDate = parseDateHeader(
                headers[FIRST_REQUEUE_TIMESTAMP_HEADER],
              );
              const retryCount = Number(headers[RETRY_COUNT_HEADER] ?? 0) || 0;

              let elapsedTimeInSeconds: number | undefined;
              if (firstRetryDate && lastRetryDate) {
                elapsedTimeInSeconds =
                  (lastRetryDate.getTime() - firstRetryDate.getTime()) / 1000;
              }

              const messageContent = msg.content.toString();

              const instruction = await this.onMessageReceived(
                msg,
                messageContent,
                internalConsumerTag,
                firstRetryDate,
                lastRetryDate,
                elapsedTimeInSeconds,
                retryCount,
              );
              switch (instruction) {
                case MessageProcessInstruction.OK:
                  channel.ack(msg);
                  break;
                case MessageProcessInstruction.IgnoreMessage:
                  channel.nack(msg, false, false);
                  break;
                case MessageProcessInstruction.IgnoreMessageWithRequeue: {
                  // To add a timestamp, we can't just requeue. We must publish a new message
                  // with modified properties and acknowledge the old one.
                  const newProperties =
                    this._prepareMessagePropertiesForRequeue(msg.properties);

                  // 2. Publish the new message to the same queue.
                  channel.sendToQueue(
                    queueName,
                    msg.content,
                    newProperties.properties,
                  );
                  WriteLog(
                    this._logger,
                    'info',
                    `Message requeued to ${queueName} with new timestamp. Retry count: ${newProperties.retryCount}.`,
                    { writeToConsole: true },
                  );

                  // 3. Nack the original message to remove it from the queue.
                  channel.nack(msg, false, false);
                  break;
                }
                case MessageProcessInstruction.RequeueMessageWithDelay: {
                  const messageTTLinSeconds = this._getRandomNumberInRange(
                    this.messageRetryTTLInSecondsMin,
                    this.messageRetryTTLInSecondsMax,
                  );
                  const newProperties1 =
                    this._prepareMessagePropertiesForRequeue(
                      msg.properties,
                      messageTTLinSeconds,
                    );

                  if (this.retryQueue) {
                    channel.sendToQueue(
                      this.retryQueue,
                      msg.content,
                      newProperties1.properties,
                    );
                    WriteLog(
                      this._logger,
                      'info',
                      `Message sent to retry queue '${this.retryQueue}' for delayed processing | TTL in seconds: ${messageTTLinSeconds} ; Retry count: ${newProperties1.retryCount}.`,
                      { writeToConsole: true },
                    );
                  } else {
                    WriteLog(
                      this._logger,
                      'warn',
                      `Requeue with delay requested, but no retry queue is configured. Message will be discarded.`,
                      { writeToConsole: true },
                    );
                  }

                  channel.nack(msg, false, false);
                  break;
                }
              }
            } catch (error) {
              this.onProcessingError(error as Error, internalConsumerTag, msg);
              // Avoid poison message loops by not requeueing on error
              channel.nack(msg, false, false);
            }
          })();
        },
        { consumerTag: internalConsumerTag },
      );

      this.consumers.set(internalConsumerTag, {
        channel,
        consumerTag: actualConsumerTag,
        connectionWrapper,
      });

      WriteLog(
        this._logger,
        'info',
        `Consumer ${internalConsumerTag} started to consume ${queueName} in channel ${connectionWrapper.channelCount} connected to host ${connectionWrapper.hostname}. `,
        { writeToConsole: true },
      );
    }

    //console.log(`Consumer ligados: `, this.consumers);
  }

  public async stopConsumer(consumerTag: string): Promise<void> {
    const consumer = this.consumers.get(consumerTag);
    if (!consumer) {
      WriteLog(
        this._logger,
        'warn',
        `No consumer found with tag ${consumerTag} to stop.`,
        { writeToConsole: true },
      );
      return;
    }

    //await consumer.channel.cancel(consumer.consumerTag);

    await this.handleShutdown(consumerTag);
    // The shutdown logic is triggered by the null message in the consume callback
  }

  public async stopAllConsumers(): Promise<void> {
    const allConsumerTags = Array.from(this.consumers.keys());
    for (const tag of allConsumerTags) {
      await this.stopConsumer(tag);
    }
  }

  private _prepareMessagePropertiesForRequeue(
    properties: amqplib.MessageProperties,
    messageTTLinSeconds: number = 0,
  ): { properties: amqplib.MessageProperties; retryCount: number } {
    const newProperties = { ...properties };
    newProperties.headers = { ...newProperties.headers }; // Ensure headers object is new

    if (!newProperties.headers[FIRST_REQUEUE_TIMESTAMP_HEADER]) {
      newProperties.headers[FIRST_REQUEUE_TIMESTAMP_HEADER] =
        new Date().toISOString();
    }

    newProperties.headers[REQUEUE_TIMESTAMP_HEADER] = new Date().toISOString();

    if (messageTTLinSeconds > 0) {
      newProperties.expiration = (messageTTLinSeconds * 1000).toString(); // Set expiration in milliseconds
    }

    let newRetryCount = 0;

    if (this.useRetryCountForRequedMessages) {
      newRetryCount =
        (Number(newProperties.headers[RETRY_COUNT_HEADER]) || 0) + 1;
      newProperties.headers[RETRY_COUNT_HEADER] = newRetryCount;
    }

    return { properties: newProperties, retryCount: newRetryCount };
  }

  private async handleShutdown(internalConsumerTag: string): Promise<void> {
    const consumer = this.consumers.get(internalConsumerTag);
    if (!consumer) return;

    //await consumer.channel.cancel(consumer.consumerTag);
    await consumer.channel.close();

    consumer.connectionWrapper.channelCount--;

    this.consumers.delete(internalConsumerTag);

    if (consumer.connectionWrapper.channelCount === 0) {
      consumer.connectionWrapper.connection.close();
      this.connections = this.connections.filter(
        (c) => c !== consumer.connectionWrapper,
      );
    }

    this.onConsumerShutdown(internalConsumerTag);
  }

  private async getOrCreateChannel(): Promise<{
    channel: amqplib.Channel;
    connectionWrapper: ConnectionWrapper;
  }> {
    let connectionWrapper = this.connections.find(
      (c) => c.channelCount < this.maxChannelsPerConnection,
    );

    if (!connectionWrapper) {
      let connection: amqplib.ChannelModel | null = null;
      let lastError: unknown = null;
      let hostname: string | undefined = '';

      for (const config of this.configs) {
        hostname = config.hostname;

        try {
          const properties = {
            clientProperties: {
              connection_name:
                (this.connectionDescription || 'Default Connection') +
                ` (${this.connections.length + 1})`, // This will show up in the RabbitMQ UI
              // You can add other custom properties here as well
              CustomAppInfo: 'created from node.js app (consumer)...', // Example of a custom property,
            },
            timeout: this.connectionTimeout || 10000, // Default to 10 seconds
          };

          connection = await amqplib.connect(config, properties);
          connection.on('error', (err: unknown) => {
            const error = err instanceof Error ? err : undefined;
            WriteLog(
              this._logger,
              'error',
              `RabbitMQ connection error. Host: ${hostname} | Error: ${error?.message ?? String(err)}`,
              { error, writeToConsole: true },
            );
          });

          connection.on('close', () => {
            console.log(
              'RabbitMQ Connection Closed. Cleaning up associated consumers.',
            );

            // Remove the connection from our pool of active connections.
            this.connections = this.connections.filter(
              (c) => c.connection !== connection,
            );

            let removedCount = 0;
            // Iterate over all consumers and remove the ones associated with the closed connection.
            // It is safe to delete from a Map while iterating over it in JavaScript.
            for (const [tag, consumer] of this.consumers.entries()) {
              if (consumer.connectionWrapper.connection === connection) {
                this.consumers.delete(tag);
                this.onConsumerShutdown(tag);
                removedCount++;
              }
            }

            WriteLog(
              this._logger,
              'warn',
              `RabbitMQ Connection Closed. Consumers removed: ${removedCount}. Total running: ${this.consumers.size}. Host: ${hostname}`,
              { writeToConsole: true },
            );
          });
          break; // Success, exit loop
        } catch (err: unknown) {
          WriteLog(
            this._logger,
            'error',
            `Failed to connect to RabbitMQ host: ${config.hostname}`,
            {
              error: err instanceof Error ? err : undefined,
              writeToConsole: true,
            },
          );
          lastError = err;
        }
      }

      if (!connection) {
        throw new Error('Unable to connect to any RabbitMQ host', {
          cause: lastError,
        });
      }

      connectionWrapper = {
        connection,
        channelCount: 0,
        hostname: hostname,
        id: this.connections.length + 1,
      };
      this.connections.push(connectionWrapper);
    }

    const channel = await connectionWrapper.connection.createChannel();
    connectionWrapper.channelCount++;

    return { channel, connectionWrapper };
  }
}
