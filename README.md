<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[![CI Validation](https://github.com/jlnovais/NestJsApiDemo-mysql/actions/workflows/ci.yml/badge.svg)](https://github.com/jlnovais/NestJsApiDemo-mysql/actions/workflows/ci.yml) 

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

NestJS REST API demo backed by MySQL, featuring session-based authentication, role-based access control, and employee photo uploads to OCI Object Storage (S3-compatible) and more.

## Implemented features

| Area | What you get |
|---|---|
| 🗄️ **MySQL persistence + auto schema init** | Creates `Users`, `Employee` (with `photoUrl`), `Department`, `AuditLog`, and stored procedures `Employees_List`, `Departments_List`; seeds default `user` and `admin` accounts. |
| 🔁 **Read-after-write consistency (ProxySQL-friendly)** | Request-scoped DB context (AsyncLocalStorage) + interceptor keeps a transaction open after writes so subsequent reads stick to the master connection. |
| 🔐 **Authentication (2-step) + sessions** | `/api/auth/login` (username/password) sends a verification code by email; `/api/auth/verify` establishes the session; `/api/auth/logout` destroys the session; `/api/auth/me` returns the current user from the session cookie (`session-id`). |
| 🧠 **Session store** | Uses Redis for sessions when enabled; falls back to in-memory sessions when Redis is disabled/unavailable. |
| 🛡️ **Authorization (RBAC)** | `SessionGuard` + `@AllowedUserTypes(...)` for admin/user-only routes; `@CurrentUser()` helper to access the authenticated user. |
| 👤 **Users API (admin-only)** | CRUD endpoints with validation; passwords hashed with bcrypt and never returned in responses. |
| 🧑‍💼 **Employees API** | CRUD + server-side pagination/filter/search/sort; custom pagination headers; per-route throttling; `multipart/form-data` photo upload + delete endpoints. |
| 🏢 **Departments API** | CRUD + server-side pagination/search/sort; pagination metadata via response headers; session-protected routes. |
| 🐇 **RabbitMQ messaging** | Modular sender/consumer integration via `amqplib`; multi-host support; configurable consumer concurrency; retry/requeue support (optional delayed retries via a retry queue + per-message TTL, with retry metadata headers). |
| 🧩 **RabbitMQ client (consumer bootstrap)** | `RabbitMqClientModule`/`RabbitMqClientService` wires message handlers and automatically starts/stops consumers with app lifecycle hooks; toggle with `RABBITMQ_CONSUMER_ENABLED` and configure using `RABBITMQ_CONNECTION_DESCRIPTION_CONSUMER`, `RABBITMQ_USER_QUEUE_CONSUMER`, `RABBITMQ_CONSUMER_INSTANCES_TO_START`. |
| 🪣 **Object storage integration** | Upload/delete employee photos to Oracle Cloud Infrastructure Object Storage via an S3-compatible client; validates MIME type and enforces a 5MB size limit. |
| 🧾 **Auditing** | Writes employee change events to `AuditLog` (actor, ip, user-agent, JSON payload with before/changes). |
| 📚 **API docs + tooling** | Swagger UI at `/api/docs`; script `npm run generate:openapi` outputs `openapi.yaml`. |
| 🧰 **Ops/robustness** | Global exception filter; CORS with credentials; rate limiting via `@nestjs/throttler`; `/api/health` includes DB connectivity check. |

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
