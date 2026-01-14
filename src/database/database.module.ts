import { Module, Global } from '@nestjs/common';
import { MysqlDatabaseService } from './mysql-database.service';
import { DatabaseContextService } from './database-context.service';

@Global()
@Module({
  providers: [MysqlDatabaseService, DatabaseContextService],
  exports: [MysqlDatabaseService, DatabaseContextService],
})
export class DatabaseModule {}
