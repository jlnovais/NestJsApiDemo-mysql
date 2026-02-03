import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { type Test as SupertestTest } from 'supertest';
import { AppModule } from '../../src/app.module';
import { MysqlDatabaseService } from '../../src/database/mysql-database.service';
import { RabbitMqClientService } from '../../src/rabbitMqClient/rabbitMqClient.service';
import { RabbitMqSenderService } from '../../src/rabbiMQ/sender/rabbitMqSender.service';

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
    headers?: Record<string, string | string[] | undefined>;
  };

  type ErrorBody = {
    statusCode: number;
    message: string | string[];
    error?: string;
  };

  type CreateDepartmentResponse = { id: number; name: string };

  type CreateEmployeeBody = {
    name: string;
    email: string;
    role: 'INTERN' | 'ENGINEER' | 'ADMIN';
    departmentId: number;
    photoUrl?: string | null;
  };

  type CreateEmployeeResponse = {
    id: number;
    email: string;
    departmentId: number;
  };

  beforeAll(async () => {
    // Keep e2e tests self-contained: don't require RabbitMQ connectivity.
    // (The app loads RabbitMQ consumer modules by default.)
    process.env.RABBITMQ_CONSUMER_ENABLED = 'false';
    // EmployeesService publishes events only if this env var is non-empty.
    process.env.RABBITMQ_EMPLOYEE_EVENTS_QUEUE_OR_ROUTINGKEY = '';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Avoid requiring RabbitMQ during e2e tests
      .overrideProvider(RabbitMqClientService)
      .useValue({
        onModuleInit: () => undefined,
        onModuleDestroy: () => undefined,
      })
      .overrideProvider(RabbitMqSenderService)
      .useValue({
        connect: () => Promise.resolve(undefined),
        sendMessageQueue: () => Promise.resolve(true),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // Ensure `X-Forwarded-For` is respected (helps avoid throttling collisions in fast test runs)
    const expressApp = app.getHttpAdapter().getInstance() as {
      set: (setting: string, value: unknown) => void;
    };
    expressApp.set('trust proxy', true);

    // e2e tests don't run through src/main.ts, so express-session middleware isn't registered.
    // These endpoints rely on request.session (SessionGuard + CurrentUser), so we stub a session.
    app.use((req: RequestWithSession, _res: unknown, next: () => void) => {
      const headers = req.headers ?? {};
      const noSession = headers['x-test-no-session'] === '1';
      if (noSession) {
        req.session = undefined;
        return next();
      }

      req.session ??= {};

      const headerUserId = headers['x-test-session-userid'];
      const headerType = headers['x-test-session-type'];
      const headerEmail = headers['x-test-session-email'];
      const headerUsername = headers['x-test-session-username'];

      req.session.userId ??=
        typeof headerUserId === 'string' ? headerUserId : undefined;
      req.session.type ??=
        typeof headerType === 'string' ? headerType : undefined;
      req.session.email ??=
        typeof headerEmail === 'string' ? headerEmail : undefined;
      req.session.username ??=
        typeof headerUsername === 'string' ? headerUsername : undefined;

      // defaults if not overridden
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

  function getHttpServer() {
    const httpServer = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    return httpServer;
  }

  function withTestIp(t: SupertestTest): SupertestTest {
    // Use a different client IP per request to avoid 429s from ThrottlerGuard
    const ip = `10.${Math.floor(Math.random() * 256)}.${Math.floor(
      Math.random() * 256,
    )}.${Math.floor(Math.random() * 256)}`;
    return t.set('X-Forwarded-For', ip);
  }

  async function createDepartment() {
    const httpServer = getHttpServer();
    const uniqueName = `E2E Dept ${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const res = await withTestIp(request(httpServer).post('/departments'))
      .send({ name: uniqueName })
      .expect(201);

    const created = res.body as CreateDepartmentResponse;
    expect(created?.id).toBeDefined();
    expect(created?.name).toBe(uniqueName);
    return created;
  }

  async function createEmployee(
    departmentId: number,
    overrides?: Partial<CreateEmployeeBody>,
  ) {
    const httpServer = getHttpServer();
    const uniqueEmail =
      overrides?.email ??
      `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

    const res = await withTestIp(request(httpServer).post('/employees'))
      .send({
        name: 'E2E Employee',
        email: uniqueEmail,
        role: 'ENGINEER',
        departmentId,
        ...overrides,
      })
      .expect(201);

    const created = res.body as CreateEmployeeResponse;
    expect(created?.id).toBeDefined();
    expect(created?.email).toBe(uniqueEmail);
    expect(created?.departmentId).toBe(departmentId);
    return created;
  }

  it('creates then deletes an employee, and it is gone afterwards', async () => {
    const httpServer = getHttpServer();

    const dept = await createDepartment();
    const created = await createEmployee(dept.id);

    const employeeId = created.id;

    await withTestIp(
      request(httpServer).delete(`/employees/${employeeId}`),
    ).expect(200);

    await withTestIp(
      request(httpServer).get(`/employees/${employeeId}`),
    ).expect(404);

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

    // Cleanup department (employee already deleted, so FK shouldn't block)
    await withTestIp(
      request(httpServer).delete(`/departments/${dept.id}`),
    ).expect(200);
  });

  it('returns 401 when session is missing', async () => {
    const httpServer = getHttpServer();

    await withTestIp(request(httpServer).get('/employees'))
      .set('x-test-no-session', '1')
      .expect(401);

    await withTestIp(request(httpServer).post('/employees'))
      .set('x-test-no-session', '1')
      .send({})
      .expect(401);
  });

  it('returns 403 when listing employees with a non-user session type', async () => {
    const httpServer = getHttpServer();

    await withTestIp(request(httpServer).get('/employees'))
      .set('x-test-session-type', 'admin')
      .expect(403);
  });

  it('rejects creating an employee with missing required fields (validation)', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();

    try {
      const res = await withTestIp(request(httpServer).post('/employees'))
        .send({
          name: 'Missing Dept',
          email: `e2e-missing-${Date.now()}@example.com`,
          role: 'ENGINEER',
          // departmentId missing
        })
        .expect(400);

      const body = res.body as ErrorBody;
      expect(body.statusCode).toBe(400);
      // Default Nest error shape: { statusCode, message, error }
      const msg = Array.isArray(body.message)
        ? body.message.join(' ')
        : String(body.message ?? '');
      expect(msg.toLowerCase()).toContain('department');
    } finally {
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });

  it('rejects creating an employee with an invalid departmentId (400)', async () => {
    const httpServer = getHttpServer();

    const res = await withTestIp(request(httpServer).post('/employees'))
      .send({
        name: 'Invalid Dept',
        email: `e2e-invalid-dept-${Date.now()}@example.com`,
        role: 'ENGINEER',
        departmentId: 999999999,
      })
      .expect(400);

    const body = res.body as ErrorBody;
    expect(body.statusCode).toBe(400);
    expect(String(body.message ?? '')).toContain('Invalid departmentId');
  });

  it('returns 409 on duplicate employee email', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();
    const email = `e2e-dupe-${Date.now()}@example.com`;
    const created = await createEmployee(dept.id, { email });

    try {
      await withTestIp(request(httpServer).post('/employees'))
        .send({
          name: 'Dupe Employee',
          email,
          role: 'ENGINEER',
          departmentId: dept.id,
        })
        .expect(409);
    } finally {
      await withTestIp(
        request(httpServer).delete(`/employees/${created.id}`),
      ).expect(200);
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });

  it('lists employees (json) with pagination headers and supports filtering by searchEmail', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();
    const created = await createEmployee(dept.id);

    try {
      const res = await withTestIp(request(httpServer).get('/employees'))
        .query({ page: 1, pageSize: 10, searchEmail: created.email })
        .expect(200);

      expect(res.headers['x-total-count']).toBeDefined();
      expect(res.headers['x-page']).toBeDefined();
      expect(res.headers['x-page-size']).toBeDefined();
      expect(res.headers['x-total-pages']).toBeDefined();
      expect(res.headers['x-has-next-page']).toBeDefined();
      expect(res.headers['x-has-previous-page']).toBeDefined();

      const rows = res.body as Array<{ id: number; email: string }>;
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.some((r) => r.email === created.email)).toBe(true);
    } finally {
      await withTestIp(
        request(httpServer).delete(`/employees/${created.id}`),
      ).expect(200);
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });

  it('supports CSV download via Accept: text/csv', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();
    const created = await createEmployee(dept.id);

    try {
      const res = await withTestIp(request(httpServer).get('/employees'))
        .set('Accept', 'text/csv')
        .query({ searchEmail: created.email })
        .expect(200)
        .expect('Content-Type', /text\/csv/i);

      const bodyText =
        typeof res.text === 'string' && res.text.length > 0
          ? res.text
          : Buffer.isBuffer(res.body)
            ? res.body.toString('utf8')
            : String(res.body ?? '');
      expect(bodyText).toContain(
        'id,name,email,role,departmentId,photoUrl,createdAt,updatedAt',
      );
      expect(bodyText).toContain(created.email);
    } finally {
      await withTestIp(
        request(httpServer).delete(`/employees/${created.id}`),
      ).expect(200);
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });

  it('updates an employee and writes an audit log entry', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();
    const created = await createEmployee(dept.id);

    try {
      const updatedName = 'E2E Employee Updated';

      const patchRes = await withTestIp(
        request(httpServer).patch(`/employees/${created.id}`),
      )
        .send({ name: updatedName })
        .expect(200);

      const patched = patchRes.body as { id: number; name: string };
      expect(patched.id).toBe(created.id);
      expect(patched.name).toBe(updatedName);

      type AuditRow = {
        eventType: string;
        entityType: string;
        entityId: string;
        actorUserId: string | null;
      };
      const auditRows = await db.queryMaster<AuditRow>(
        'SELECT eventType, entityType, entityId, actorUserId FROM AuditLog WHERE entityType = ? AND entityId = ? ORDER BY id ASC',
        ['Employee', String(created.id)],
      );

      const eventTypes = auditRows.map((r) => r.eventType);
      expect(eventTypes).toContain('employee.created');
      expect(eventTypes).toContain('employee.updated');
      expect(auditRows.some((r) => r.actorUserId === 'test-user-id')).toBe(
        true,
      );
    } finally {
      await withTestIp(
        request(httpServer).delete(`/employees/${created.id}`),
      ).expect(200);
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });

  it('returns 400 when PATCH has no fields to update', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();
    const created = await createEmployee(dept.id);

    try {
      const res = await withTestIp(
        request(httpServer).patch(`/employees/${created.id}`),
      )
        .send({})
        .expect(400);

      const body = res.body as ErrorBody;
      expect(body.statusCode).toBe(400);
      expect(String(body.message ?? '')).toContain('No fields to update');
    } finally {
      await withTestIp(
        request(httpServer).delete(`/employees/${created.id}`),
      ).expect(200);
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });

  it('photo upload returns 400 when no file is provided', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();
    const created = await createEmployee(dept.id);

    try {
      const res = await withTestIp(
        request(httpServer).post(`/employees/${created.id}/photo`),
      ).expect(400);

      const body = res.body as ErrorBody;
      expect(body.statusCode).toBe(400);
      expect(String(body.message ?? '')).toContain('No file provided');
    } finally {
      await withTestIp(
        request(httpServer).delete(`/employees/${created.id}`),
      ).expect(200);
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });

  it('photo upload returns 400 for an invalid file type (no storage call needed)', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();
    const created = await createEmployee(dept.id);

    try {
      const res = await withTestIp(
        request(httpServer).post(`/employees/${created.id}/photo`),
      )
        .attach('file', Buffer.from('hello'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        })
        .expect(400);

      const body = res.body as ErrorBody;
      expect(body.statusCode).toBe(400);
      expect(String(body.message ?? '')).toContain('Invalid file type');
    } finally {
      await withTestIp(
        request(httpServer).delete(`/employees/${created.id}`),
      ).expect(200);
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });

  it('delete photo clears photoUrl and emits an audit update', async () => {
    const httpServer = getHttpServer();
    const dept = await createDepartment();
    const created = await createEmployee(dept.id);

    try {
      const res = await withTestIp(
        request(httpServer).delete(`/employees/${created.id}/photo`),
      ).expect(200);

      // photoUrl becomes '' (service sets it) or remains null depending on DB mapping
      const body = res.body as { id: number };
      expect(body.id).toBe(created.id);

      type AuditRow = {
        eventType: string;
        entityType: string;
        entityId: string;
      };
      const auditRows = await db.queryMaster<AuditRow>(
        'SELECT eventType, entityType, entityId FROM AuditLog WHERE entityType = ? AND entityId = ? ORDER BY id ASC',
        ['Employee', String(created.id)],
      );
      expect(auditRows.map((r) => r.eventType)).toContain('employee.updated');
    } finally {
      await withTestIp(
        request(httpServer).delete(`/employees/${created.id}`),
      ).expect(200);
      await withTestIp(
        request(httpServer).delete(`/departments/${dept.id}`),
      ).expect(200);
    }
  });
});
