import { Module } from '@nestjs/common';
import { RabbitMQConsumerModule } from './consumer/rabbitmq-consumer.module';
import { RabbitMQSenderModule } from './sender/rabbitmq-sender.module';
import { RabbitMQConsumerService } from './consumer/rabbitMQConsumer.service';
import { RabbitMqSenderService } from './sender/rabbitMqSender.service';

@Module({
  imports: [RabbitMQSenderModule, RabbitMQConsumerModule],
  exports: [
    // Re-export sub-modules for backwards compatibility (and their providers).
    RabbitMQSenderModule,
    RabbitMQConsumerModule,
    // Explicitly export the services too, since existing modules may rely on that.
    RabbitMqSenderService,
    RabbitMQConsumerService,
  ],
})
export class RabbiMQModule {}
