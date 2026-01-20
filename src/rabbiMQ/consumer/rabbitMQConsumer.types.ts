import amqplib from 'amqplib';

//export interface RabbitMQConfig extends amqplib.Options.Connect {}

//export interface ConsumerServiceConfig {
//    rabbitMQConfig: RabbitMQConfig;
//    maxChannelsPerConnection?: number;
//}

export const MessageProcessInstruction = Object.freeze({
  OK: 'OK',
  IgnoreMessage: 'IGNORE_MESSAGE',
  IgnoreMessageWithRequeue: 'IGNORE_MESSAGE_WITH_REQUEUE',
  RequeueMessageWithDelay: 'REQUEUE_MESSAGE_WITH_DELAY',
});

export type MessageProcessInstructionType =
  (typeof MessageProcessInstruction)[keyof typeof MessageProcessInstruction];

export type ReceiveMessageDelegate = (
  messageObject: amqplib.ConsumeMessage,
  messageContent: string,
  consumerName: string,
  firstRetryDate?: Date,
  lastRetryDate?: Date,
  elapsedTimeInSeconds?: number,
  retryCount?: number,
) => Promise<MessageProcessInstructionType>;
export type ShutdownDelegate = (consumerTag: string) => void;
export type ReceiveMessageErrorDelegate = (
  error: Error,
  consumerTag: string,
  message: amqplib.ConsumeMessage,
) => void;
export type ConnectionClosedDelegate = (
  hostname: string | undefined,
  removedCount: number,
  totalRunning: number,
) => void;
