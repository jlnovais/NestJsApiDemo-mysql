# Redis Configuration

This application supports storing sessions and verification codes in Redis, with automatic fallback to in-memory storage if Redis is unavailable or disabled.

## Environment Variables

Add the following variables to your `.env` file:

```env
# Redis Configuration
REDIS_ENABLED=true                    # Set to 'true' to enable Redis, 'false' to use in-memory storage
REDIS_HOST=localhost                  # Redis host (default: localhost)
REDIS_PORT=6379                       # Redis port (default: 6379)
REDIS_PASSWORD=123                    # Redis password (optional, leave empty if no password)
REDIS_DB=0                            # Redis database number (default: 0)
```

## How It Works

### Sessions
- **Redis Key Prefix**: `sess:`
- When Redis is enabled and connected, sessions are stored in Redis
- If Redis is unavailable or disabled, sessions fall back to in-memory storage
- Session expiration is handled automatically (24 hours by default)

### Verification Codes
- **Redis Key Prefix**: `code:`
- When Redis is enabled and connected, verification codes are stored in Redis with automatic expiration
- If Redis is unavailable or disabled, codes fall back to in-memory storage
- Codes expire after the configured time (default: 10 minutes, configurable via `CODE_EXPIRY_MINUTES`)

## Enabling/Disabling Redis

To enable Redis:
```env
REDIS_ENABLED=true
```

To disable Redis (use in-memory storage):
```env
REDIS_ENABLED=false
```

Or simply remove/comment out the `REDIS_ENABLED` variable (defaults to disabled).

## Fallback Behavior

The application automatically falls back to in-memory storage if:
- `REDIS_ENABLED` is set to `false` or not set
- Redis connection fails
- Redis becomes unavailable during runtime

No code changes are required - the fallback is automatic and transparent.

## Testing Redis Connection

When the application starts, you'll see one of these messages:
- `Redis connected successfully to localhost:6379` - Redis is working
- `Redis is disabled. Using in-memory storage.` - Redis is disabled
- `Failed to initialize Redis: ...` - Redis connection failed, using in-memory storage
- `Using Redis store for sessions` - Sessions are using Redis
- `Using in-memory store for sessions` - Sessions are using in-memory storage

## Example .env Configuration

```env
# Application
PORT=3000
NODE_ENV=development

# Session
SESSION_SECRET=your-secret-key-change-in-production

# Redis (optional - set REDIS_ENABLED=false to disable)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=123
REDIS_DB=0

# Verification Code
CODE_EXPIRY_MINUTES=10
```
