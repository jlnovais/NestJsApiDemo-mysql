import { DatabaseModule } from 'src/database/database.module';
import { AuditModule } from 'src/audit/audit.module';
import { DepartmentsRepository } from './repository/departments.repository';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';
import { Module } from '@nestjs/common';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsRepository],
  exports: [DepartmentsRepository],
})
export class DepartmentsModule {}
