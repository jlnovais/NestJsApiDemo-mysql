# WebSockets and Socket.IO

This application provides two real-time communication endpoints: **Socket.IO** and **native WebSocket**. Both run alongside the main REST API and support the same demo events (`echo`, `message`, `time`). **Socket.IO** also broadcasts **employee events** to all connected clients whenever employees are created, updated, deleted, or when photos are uploaded/deleted.

## Overview

| Feature      | Socket.IO                    | Native WebSocket          |
| ------------ | ---------------------------- | ------------------------- |
| **Port**     | Same as main app (default 3000) | Separate port (default 3001) |
| **Path**     | `/socket-io-demo` + `/my-demo` | `/ws-demo`                |
| **Library**  | `socket.io`                  | `ws`                      |
| **Protocol** | Socket.IO protocol           | Standard WebSocket         |

---

## Socket.IO

Socket.IO runs on the same HTTP server as the main application. It provides namespaces, rooms, and automatic reconnection.

### Connection URL

```
http://localhost:3000/socket-io-demo/my-demo
```

- **Namespace**: `/socket-io-demo`
- **Path**: `/my-demo`

### Client Usage (JavaScript/TypeScript)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  path: '/my-demo',
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

// Send events
socket.emit('echo', 'hello');
socket.emit('message', 'test');
socket.emit('time', 'now');

// Receive responses
socket.on('echo', (data) => console.log('echo:', data));
socket.on('message', (data) => console.log('message:', data));
socket.on('time', (data) => console.log('time:', data));
```

### Events

| Event     | Payload | Behavior                                      |
| --------- | ------- | --------------------------------------------- |
| `echo`    | string  | Broadcasts `echo: <payload>` to all clients    |
| `message` | string  | Broadcasts `message: <payload>` to all clients |
| `time`    | string  | Sends current time only to the sender        |

### Employee Events (server → clients)

The server broadcasts `employee` events to all connected Socket.IO clients whenever the Employees API performs create, update, delete, photo upload, or photo delete operations. Clients can listen for these events to keep their UI in sync with backend changes in real time.

| Event      | Direction | Payload                                                                 |
| ---------- | --------- | ----------------------------------------------------------------------- |
| `employee` | server → all | JSON string: `{ event, eventType, data }` where `eventType` is one of `create`, `update`, `delete`, `photo_upload`, `photo_delete` and `data` is the employee object |

**Client usage:**

```javascript
socket.on('employee', (payload) => {
  const { event, eventType, data } = JSON.parse(payload);
  console.log(`Employee ${eventType}:`, data);
  // e.g. refresh list, update cache, show toast notification
});
```

---

## Native WebSocket

The native WebSocket server runs on a **separate port** using the `ws` library. It is fully compatible with browser `WebSocket` and standard WebSocket clients.

### Connection URL

```
ws://localhost:3001/ws-demo
```

### Environment Variables

```env
WS_PORT=3001    # Port for the native WebSocket server (default: 3001)
```

### Message Format

The NestJS `WsAdapter` expects messages as JSON with `event` and `data` fields:

```json
{"event": "echo", "data": "hello"}
```

### Client Usage (Browser)

```javascript
const ws = new WebSocket('ws://localhost:3001/ws-demo');

ws.onopen = () => {
  ws.send(JSON.stringify({ event: 'echo', data: 'hello' }));
  ws.send(JSON.stringify({ event: 'time', data: 'now' }));
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  console.log('Received:', msg.event, msg.data);
};
```

### Events

| Event     | Data (example) | Behavior                                      |
| --------- | -------------- | --------------------------------------------- |
| `echo`    | string         | Broadcasts `echo: <data>` to all clients       |
| `message` | string         | Broadcasts `message: <data>` to all clients  |
| `time`    | string         | Sends current time only to the sender         |

---

## Testing with Postman

### Socket.IO

Postman supports Socket.IO. Create a new **Socket.IO** request:

1. **URL**: `http://localhost:3000`
2. **Path**: `/my-demo`
3. **Namespace**: `/socket-io-demo`
4. Connect and emit events: `echo`, `message`, `time` with string payloads.
5. Listen for `employee` events to receive real-time employee CRUD/photo updates (triggered by REST API calls).

### Native WebSocket

1. Create a new **WebSocket Request**
2. **URL**: `ws://localhost:3001/ws-demo`
3. Click **Connect**
4. Send JSON messages in the format: `{"event": "echo", "data": "hello"}`

---

## Project Structure

```
src/websockets/
├── socket-io/
│   ├── socket-io.gateway.ts
│   ├── socket-io.service.ts
│   └── socket-io.module.ts
└── ws/
    ├── ws.gateway.ts
    ├── ws.module.ts
    ├── ws-app.module.ts
    └── bootstrap-ws.ts
```

- **Socket.IO** is part of the main app and uses the default `IoAdapter`.
- **Native WebSocket** is bootstrapped separately in `main.ts` after the main app starts, using `WsAdapter` from `@nestjs/platform-ws`.

---

## Startup Logs

When the application starts successfully, you should see:

```
Application is running on: http://localhost:3000
Swagger documentation available at: http://localhost:3000/api/docs
Native WebSocket server is running on: ws://localhost:3001/ws-demo
```
