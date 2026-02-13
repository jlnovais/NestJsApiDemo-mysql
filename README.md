<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[![CI Validation](https://github.com/jlnovais/NestJsApiDemo-mysql/actions/workflows/ci.yml/badge.svg)](https://github.com/jlnovais/NestJsApiDemo-mysql/actions/workflows/ci.yml) 

## Description

NestJS REST API demo backed by MySQL, featuring session-based authentication, role-based access control, and employee photo uploads to OCI Object Storage (S3-compatible) and more.

## Quick start (local)

Prereqs: Node.js **22+**, a running **MySQL** (or ProxySQL in front of MySQL). **Redis/RabbitMQ/OCI storage** are optional.

1) Install dependencies:

```bash
npm install
```

2) Create your env file:

- Copy `.env.template` → `.env`
- Adjust at least the MySQL settings (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`)

3) Run the API:

```bash
# watch mode (recommended for dev)
npm run start:dev
```

- API base path: `http://localhost:<PORT>/api`
- Swagger UI: `http://localhost:<PORT>/api/docs`

Default seeded users (created automatically when `Users` is empty):
- `user` / `123`
- `admin` / `123`

## Implemented features

| Area | What you get |
|---|---|
| 🗄️ **MySQL persistence + auto schema init** | Creates `Users`, `Employee` (with `photoUrl` + `departmentId` FK), `Department`, `AuditLog`, and stored procedures `Employees_List`, `Departments_List`; seeds default `user` and `admin` accounts plus a default `General` department. |
| 🔁 **Read-after-write consistency (ProxySQL-friendly)** | Request-scoped DB context (AsyncLocalStorage) + interceptor keeps a transaction open after writes so subsequent reads stick to the master connection. |
| 🔐 **Authentication (2-step) + sessions** | `/api/auth/login` (username/password) sends a verification code by email; `/api/auth/verify` establishes the session; `/api/auth/logout` destroys the session; `/api/auth/me` returns the current user from the session cookie (`session-id`). |
| 🧠 **Session store** | Uses Redis for sessions when enabled; falls back to in-memory sessions when Redis is disabled/unavailable. |
| 🛡️ **Authorization (RBAC)** | `SessionGuard` + `@AllowedUserTypes(...)` for admin/user-only routes; `@CurrentUser()` helper to access the authenticated user. |
| 👤 **Users API (admin-only)** | CRUD endpoints with validation; passwords hashed with bcrypt and never returned in responses. |
| 🧑‍💼 **Employees API** | CRUD + server-side pagination/filter/search/sort; custom pagination headers; per-route throttling; `multipart/form-data` photo upload + delete endpoints; **CSV export** for `GET /api/employees` via `Accept: text/csv` (downloads `employees.csv`, UTF-8 BOM for Excel). |
| ⚡ **Employees list caching (Redis)** | Optional Redis-backed caching for `GET /api/employees` (JSON + CSV): enable with `CACHE_ENABLED=true`, TTL via `CACHE_TTL_SECONDS` (default **60s**). Cache key includes role + pagination + filters + sort. No explicit invalidation (data may be stale up to TTL). |
| 🏢 **Departments API** | CRUD + server-side pagination/search/sort; pagination metadata via response headers; session-protected routes. |
| 🐇 **RabbitMQ messaging** | Modular sender/consumer integration via `amqplib`; multi-host support; configurable consumer concurrency; retry/requeue support (optional delayed retries via a retry queue + per-message TTL, with retry metadata headers). |
| 🧩 **RabbitMQ client (consumer bootstrap)** | `RabbitMqClientModule`/`RabbitMqClientService` wires message handlers and automatically starts/stops consumers with app lifecycle hooks; toggle with `RABBITMQ_CONSUMER_ENABLED` and configure using `RABBITMQ_CONNECTION_DESCRIPTION_CONSUMER`, `RABBITMQ_USER_QUEUE_CONSUMER`, `RABBITMQ_CONSUMER_INSTANCES_TO_START`. |
| 🪣 **Object storage integration** | Upload/delete employee photos to Oracle Cloud Infrastructure Object Storage via an S3-compatible client; validates MIME type and enforces a 5MB size limit. |
| 🧾 **Auditing** | Writes employee change events to `AuditLog` (actor, ip, user-agent, JSON payload with before/changes). |
| 📚 **API docs + tooling** | Swagger UI at `/api/docs`; script `npm run generate:openapi` outputs `openapi.yaml`. |
| 🔌 **WebSockets + Socket.IO** | Two real-time endpoints: **Socket.IO** at `http://localhost:<PORT>/socket-io-demo/my-demo` (same port as API) and **native WebSocket** at `ws://localhost:3001/ws-demo` (separate port, configurable via `WS_PORT`). Both support `echo`, `message`, and `time` demo events. **Employee events**: Socket.IO broadcasts `employee` events to all connected clients whenever employees are created, updated, deleted, or when photos are uploaded/deleted—payload includes `eventType` (`create`, `update`, `delete`, `photo_upload`, `photo_delete`) and the employee data. See `docs/WEBSOCKETS.md`. |
| 🧰 **Ops/robustness** | Global exception filter; CORS with credentials; rate limiting via `@nestjs/throttler`; `/api/health` includes DB connectivity check. |
| ✅ **Testing + CI/CD** | Jest unit + e2e tests; GitHub Actions CI workflow; release workflow + changelog automation (semantic-release). |
| 🐳 **Docker support (app-only)** | Multi-stage `dockerfile` builds a slim production image; run the API with a host `--env-file` (see “Docker” section for `NODE_ENV` secure-cookie caveat and `host.docker.internal`). |

## Compile and run the project

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## Docker (app-only container)

This repo includes a multi-stage `dockerfile` that builds and runs the API (Node 22 slim). It’s intended to run **only the API** in a container; MySQL/Redis/RabbitMQ typically run outside (host or another machine).

- Build:

```bash
docker build -t nestjs-api-demo .
```

- Run (example using the provided host env file):

```bash
docker run --rm --name nestjs-api-demo-api -p 3222:3222 --env-file "D:\projectos-Demos-Node\NestJsApiDemo-mysql\env-for-docker\.env" nestjs-api-demo
```

Important notes:
- The image sets `NODE_ENV=production` by default, which makes the session cookie **HTTPS-only** (`secure: true`). For local HTTP testing, override: `-e NODE_ENV=development`.
- Inside Docker, `localhost` means “this container”. If your dependencies run on the host machine, use `host.docker.internal` (see `env-for-docker/README.md`).
- Docker `--env-file` **does not support inline comments** (anything after `=` becomes part of the value). Keep comments on their own lines.

More details: see `env-for-docker/README.md`.

## Run tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## Docs (deep dives)

- `docs/database-access.md`: read-after-write consistency + ProxySQL notes (AsyncLocalStorage “sticky” connection)
- `docs/MYSQL_SETUP.md`: MySQL notes
- `docs/REDIS_SETUP.md`: Redis sessions + verification code store behavior
- `docs/storage-setup.md`: OCI Object Storage (S3-compatible) photo upload setup
- `docs/WEBSOCKETS.md`: Socket.IO and native WebSocket endpoints, client usage, Postman testing
- `src/rabbiMQ/*`: RabbitMQ sender/consumer details
- `openapi.yaml`: generated OpenAPI spec (`npm run generate:openapi`)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
