import { Module } from '@nestjs/common';
import { RabbitMqClientService } from './rabbitMqClient.service';

import { RabbitMQConsumerModule } from 'src/rabbiMQ/consumer/rabbitmq-consumer.module';

//@Global()
@Module({
  imports: [RabbitMQConsumerModule],
  providers: [RabbitMqClientService],
  exports: [RabbitMqClientService],
})
export class RabbitMqClientModule {}
