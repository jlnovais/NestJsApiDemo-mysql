import { Injectable } from '@nestjs/common';
import { MysqlDatabaseService } from 'src/database/mysql-database.service';

export interface AuditLogEvent {
  eventType: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  actorType?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  data?: unknown;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly db: MysqlDatabaseService) {}

  async insert(event: AuditLogEvent): Promise<void> {
    const sql = `
      INSERT INTO AuditLog (eventType, entityType, entityId, actorUserId, actorType, ip, userAgent, data, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // Store "no data" as SQL NULL (not JSON null) for consistency.
    const data =
      event.data === undefined || event.data === null
        ? null
        : JSON.stringify(event.data);

    await this.db.execute(sql, [
      event.eventType,
      event.entityType,
      event.entityId,
      event.actorUserId ?? null,
      event.actorType ?? null,
      event.ip ?? null,
      event.userAgent ?? null,
      data,
    ]);
  }
}
