import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { MysqlDatabaseService } from '../src/database/mysql-database.service';

describe('EmployeesController (e2e)', () => {
  let app: INestApplication;
  let db: MysqlDatabaseService;

  type RequestWithSession = {
    session?: {
      userId?: string;
      username?: string;
      email?: string;
      type?: string;
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // e2e tests don't run through src/main.ts, so express-session middleware isn't registered.
    // These endpoints rely on request.session (SessionGuard + CurrentUser), so we stub a session.
    app.use((req: RequestWithSession, _res: unknown, next: () => void) => {
      req.session ??= {};
      req.session.userId ??= 'test-user-id';
      req.session.username ??= 'test';
      req.session.email ??= 'test@example.com';
      req.session.type ??= 'user';
      next();
    });

    await app.init();
    db = app.get(MysqlDatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates then deletes an employee, and it is gone afterwards', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];

    const uniqueEmail = `e2e-${Date.now()}@example.com`;

    const createRes = await request(httpServer)
      .post('/employees')
      .send({
        name: 'E2E Employee',
        email: uniqueEmail,
        role: 'ENGINEER',
      })
      .expect(201);

    const created = createRes.body as { id: number; email: string };

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.email).toBe(uniqueEmail);

    const employeeId = created.id;

    await request(httpServer).delete(`/employees/${employeeId}`).expect(200);

    await request(httpServer).get(`/employees/${employeeId}`).expect(404);

    // Verify audit logs exist (created + deleted)
    type AuditRow = {
      eventType: string;
      entityType: string;
      entityId: string;
      actorUserId: string | null;
    };

    const auditRows = await db.queryMaster<AuditRow>(
      'SELECT eventType, entityType, entityId, actorUserId FROM AuditLog WHERE entityType = ? AND entityId = ? ORDER BY id ASC',
      ['Employee', String(employeeId)],
    );

    const eventTypes = auditRows.map((r) => r.eventType);
    expect(eventTypes).toContain('employee.created');
    expect(eventTypes).toContain('employee.deleted');

    // Actor should be present in at least one record (created/deleted should both carry it)
    expect(auditRows.some((r) => r.actorUserId === 'test-user-id')).toBe(true);
  });
});
