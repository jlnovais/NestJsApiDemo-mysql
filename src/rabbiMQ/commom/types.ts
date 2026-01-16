/*
export interface RabbitMQConfig extends amqplib.Options.Connect {}

const rabbitConfig: RabbitMQConfig = {
    protocol: 'amqp',
    hostname: 'localhost',
    port: 5672,
    username: 'test',
    password: '123',
    vhost: 'nodejs-demo',
};

*/

export interface RabbitMqConnectionDetailsBase {
  hostname: string;
  port?: number;
  username?: string;
  password?: string;
  vhost?: string;
  connectionDescription?: string; // Optional description or custom property for the connection
  connectionTimeout?: number;
}

export interface RabbitMqConnectionDetailsSender
  extends RabbitMqConnectionDetailsBase {
  selectRandomHost: boolean;
  selectSequencialHost: boolean;
  connectionRetryDelay: number; // Optional delay for retrying connection
  connectionRetryAttempts: number; // Optional number of retry attempts
}

export interface RabbitMqConnectionDetailsConsumer
  extends RabbitMqConnectionDetailsBase {
  maxChannelsPerConnection?: number;
  useRetryCountForRequedMessages?: boolean;
  messageRetryTTLInSecondsMin?: number;
  messageRetryTTLInSecondsMax?: number;
  retryQueue?: string; // Optional retry queue name for delayed processing
}

export interface LoggerWrapper {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, error?: Error) => void;
}
