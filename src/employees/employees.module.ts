import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeesRepository } from './repository/employees.repository';
import { DatabaseModule } from 'src/database/database.module';
import { StorageModule } from 'src/storage/storage.module';
import { AuditModule } from 'src/audit/audit.module';
import { RabbiMQModule } from 'src/rabbiMQ/rabbiMQ.module';

@Module({
  imports: [DatabaseModule, StorageModule, AuditModule, RabbiMQModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeesRepository],
})
export class EmployeesModule {}
