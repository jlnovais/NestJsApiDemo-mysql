import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeesRepository } from './repository/employees.repository';
import { DatabaseModule } from 'src/database/database.module';
import { StorageModule } from 'src/storage/storage.module';
import { AuditModule } from 'src/audit/audit.module';
import { RabbitMQConsumerModule } from 'src/rabbiMQ/consumer/rabbitmq-consumer.module';
import { RabbitMQSenderModule } from 'src/rabbiMQ/sender/rabbitmq-sender.module';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AuditModule,
    RabbitMQSenderModule,
    RabbitMQConsumerModule,
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeesRepository],
})
export class EmployeesModule {}
