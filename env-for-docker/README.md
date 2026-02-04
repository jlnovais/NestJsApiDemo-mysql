# Docker (app-only) using host env file

This folder contains an example environment file to run the **NestJS API container only**.

- Your MySQL/Redis/RabbitMQ run **outside** this container (you manage them separately).
- The container reads configuration from the **host** via `--env-file`.

## Build the image (local)

Run this from the project root (`D:\projectos-Demos-Node\NestJsApiDemo-mysql`):

```bash
docker build -t nestjs-api-demo .
```

- `docker build`: builds a container image from the `Dockerfile` in the current directory.
- `-t nestjs-api-demo`: tags/names the image `nestjs-api-demo`.
- `.`: build context (the whole repo is sent to the Docker build).

## Run the container (local)

This command reads the env file from the **host path** below:

```bash
docker run --rm --name nestjs-api-demo-api -p 3222:3222 --env-file "D:\projectos-Demos-Node\NestJsApiDemo-mysql\env-for-docker\.env" nestjs-api-demo
```

## Session cookie note (important)

This project uses `express-session` and sets the session cookie options based on `NODE_ENV`.

- When `NODE_ENV=production`, the app configures the session cookie with `secure: true` (HTTPS-only).
  - If you call the API over plain HTTP (example: `http://localhost:3222/...` in Postman), the server will **not** set the session cookie (no `Set-Cookie`), so `/api/auth/verify` won’t produce a cookie to store/send.
- The image sets `NODE_ENV=production` by default in the `dockerfile`, so you may hit this even when running locally.

### Fix for local (HTTP) testing

- Override `NODE_ENV` when starting the container, for example:

```bash
docker run --rm --name nestjs-api-demo-api -p 3222:3222 --env-file "D:\projectos-Demos-Node\NestJsApiDemo-mysql\env-for-docker\.env" -e NODE_ENV=development nestjs-api-demo
```

### Fix for “real” production

- Use HTTPS in front of the container (and if TLS terminates at a reverse proxy, configure the app to trust the proxy so secure cookies can be set correctly).

### Alternative: mount the `.env` file into the container

```bash
docker run --rm --name nestjs-api-demo-api -p 3222:3222 -v "D:\projectos-Demos-Node\NestJsApiDemo-mysql\env-for-docker\.env:/app/.env:ro" nestjs-api-demo
```

### What each parameter means

- `docker run`: creates and starts a container from an image.
- `--rm`: automatically removes the container when it stops (keeps your machine clean).
- `--name nestjs-api-demo-api`: sets an easy-to-reference container name.
- `-p 3222:3222`: publishes container port **3222** on host port **3222**.
  - Left side (`3222`) is the **host** port you will call in your browser/client.
  - Right side (`3222`) is the **container** port the Nest app listens on.
  - Your `env-for-docker/.env` sets `PORT=3222`, so the app listens on 3222.
  - If you change `PORT`, also change the right side (and usually the left side too).
- `--env-file "D:\...\env-for-docker\.env"`: reads environment variables from that **host** file and injects them into the container as `process.env`.
  - This file is meant to stay on the host (don’t bake secrets into the image).
- `nestjs-api-demo`: the image name to run (built in the previous step).

### Important: `.env` comments with Docker `--env-file`

Docker’s `--env-file` parsing is **not** the same as some `.env` loaders:

- Lines that start with `#` are comments.
- **Inline comments are NOT supported**. Anything after the first `=` becomes part of the value.

Bad (Docker will include the comment in the value):

```env
RABBITMQ_RETRY_QUEUE_MESSAGE_TTL_IN_SECONDS_MIN=30 # Optional message TTL...
```

Good (comment on its own line):

```env
# Optional message TTL...
RABBITMQ_RETRY_QUEUE_MESSAGE_TTL_IN_SECONDS_MIN=30
```

### Run in the background (detached)

Add `-d`:

```bash
docker run -d --rm --name nestjs-api-demo-api -p 3222:3222 --env-file "D:\projectos-Demos-Node\NestJsApiDemo-mysql\env-for-docker\.env" nestjs-api-demo
```

## Useful commands

```bash
# View logs
docker logs -f nestjs-api-demo-api

# Stop the container
docker stop nestjs-api-demo-api
```

## “localhost” note (very important)

Inside Docker, `localhost` means “this container”, not your host PC.

If MySQL/Redis/RabbitMQ are running on your **host machine**, set in the env file:

- `DB_HOST=host.docker.internal`
- `REDIS_HOST=host.docker.internal`
- `RABBITMQ_HOST_SENDER=host.docker.internal`
- `RABBITMQ_HOST_CONSUMER=host.docker.internal`

If those services are on another machine, set the `*_HOST` variables to that machine’s DNS name/IP.

## Deploy (to another machine)

Two common approaches:

### Option A: build on the server

- Copy/clone the repo to the server
- Run the same build command:

```bash
docker build -t nestjs-api-demo .
```

Then run it with an env file that exists **on that server** (the path will be different).

### Option B: build locally, then ship the image

```bash
# Export image to a tar file
docker save -o nestjs-api-demo.tar nestjs-api-demo

# On the target machine: import the image
docker load -i nestjs-api-demo.tar
```

Then run `docker run ...` on the target machine with its local env file.

