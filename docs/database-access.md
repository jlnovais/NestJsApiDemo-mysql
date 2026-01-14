# Database Access Architecture

This document explains how database access is implemented in this NestJS application, including how it handles read-after-write consistency, works with ProxySQL master/replica setups, and functions with single database instances.

## Overview

The application uses a **sticky session** mechanism to ensure read-after-write consistency. This prevents issues where a write operation (INSERT/UPDATE/DELETE) is immediately followed by a read operation (SELECT) that might not see the newly written data due to replication lag in distributed database setups.

## Key Concepts

### Read-After-Write Consistency

**Read-after-write consistency** ensures that when you write data to a database and then immediately read it back, you always see the data you just wrote. This is critical in distributed database systems where:

- Writes go to the **master** database
- Reads may go to **replica** databases
- There's a delay (replication lag) between when data is written to the master and when it's available on replicas

**Problem**: If you INSERT a new employee and then immediately SELECT it, the SELECT might hit a replica that hasn't received the update yet, resulting in a "not found" error.

**Solution**: Use the same database connection (master) for both the write and the subsequent read within the same request.

### Sticky Session

A **sticky session** (also called session affinity) ensures that all database operations within a single HTTP request use the same database connection. This is implemented using:

- **AsyncLocalStorage**: Node.js API that creates an asynchronous context that persists across async operations
- **Request-scoped context**: Each HTTP request gets its own isolated context
- **Connection reuse**: Once a write occurs, subsequent reads use the same connection

### ProxySQL

**ProxySQL** is a high-performance MySQL proxy that can route queries to:
- **Master**: For write operations (INSERT, UPDATE, DELETE)
- **Replicas**: For read operations (SELECT) to distribute load

The sticky session mechanism ensures that reads after writes always go to the master, bypassing ProxySQL's read routing.

## Architecture Components

### 1. DatabaseContextService

**Location**: `src/database/database-context.service.ts`

**Purpose**: Manages the request-scoped database context using `AsyncLocalStorage`.

**Key Methods**:
- `run()`: Initializes a new context for a request
- `markWrite()`: Marks that a write operation occurred and stores the connection
- `hasWrite()`: Checks if a write occurred in the current context
- `getConnection()`: Retrieves the stored connection (master)
- `setConnection()`: Stores a connection in the context

**How it works**:
```typescript
// Each request gets its own context
const context = {
  hasWrite: false,        // Tracks if a write occurred
  connection?: PoolConnection  // Stores the master connection
}
```

### 2. DatabaseContextInterceptor

**Location**: `src/database/database-context.interceptor.ts`

**Purpose**: NestJS interceptor that wraps each HTTP request in a database context and handles cleanup.

**Responsibilities**:
- Initializes the database context at the start of each request
- Ensures the entire request lifecycle runs within the context
- Releases the connection and rolls back any uncommitted transactions when the request completes

### 3. MysqlDatabaseService

**Location**: `src/database/mysql-database.service.ts`

**Purpose**: Main database service that handles all database operations.

**Key Methods**:

#### `execute(sql, params)` - Write Operations
- Used for INSERT, UPDATE, DELETE
- Always acquires/stores a connection from the pool
- Starts a transaction (disables autocommit)
- Marks that a write occurred
- Keeps the transaction open for subsequent reads

#### `query(sql, params)` - Read Operations
- Used for SELECT queries
- **If a write occurred**: Uses the stored connection (master) within the same transaction
- **If no write occurred**: Uses the connection pool (may route to replica via ProxySQL)
- Commits the transaction after the SELECT (if it was part of a write operation)

## How It Works

### Flow Diagram

```
HTTP Request
    ↓
DatabaseContextInterceptor
    ↓
Initialize AsyncLocalStorage Context
    ↓
Controller → Service → Repository
    ↓
Repository.execute() (INSERT)
    ├─ Get connection from pool
    ├─ Store connection in context
    ├─ Start transaction
    ├─ Mark hasWrite = true
    └─ Execute INSERT (uncommitted)
    ↓
Repository.queryOne() (SELECT)
    ├─ Check: hasWrite = true?
    ├─ Use stored connection (same as INSERT)
    ├─ Execute SELECT (sees uncommitted INSERT)
    └─ Commit transaction
    ↓
Response returned
    ↓
DatabaseContextInterceptor.finalize()
    ├─ Rollback if needed
    ├─ Re-enable autocommit
    └─ Release connection
```

### Example: Creating an Employee

1. **Request arrives**: `POST /api/employees`
2. **Context initialized**: `DatabaseContextInterceptor` creates a new `AsyncLocalStorage` context
3. **INSERT executed**:
   ```typescript
   await databaseService.execute('INSERT INTO Employee ...')
   ```
   - Gets a connection from the pool
   - Stores it in context: `context.connection = connection`
   - Starts transaction: `START TRANSACTION`
   - Marks write: `context.hasWrite = true`
   - Executes INSERT (uncommitted)

4. **SELECT executed**:
   ```typescript
   await databaseService.queryOne('SELECT * FROM Employee WHERE id = ?', [insertId])
   ```
   - Checks: `hasWrite() === true` ✓
   - Uses stored connection: `getConnection()` returns the same connection
   - Executes SELECT within the same transaction (sees uncommitted INSERT)
   - Commits: `COMMIT`
   - Re-enables autocommit: `SET autocommit = 1`

5. **Request completes**: Connection released back to pool

## Transaction Management

### Transaction Lifecycle

1. **Transaction Start**: When `execute()` is called and no connection exists in context
   ```sql
   SET autocommit = 0;
   START TRANSACTION;
   ```

2. **Write Operation**: INSERT/UPDATE/DELETE executes (uncommitted)

3. **Read Operation**: SELECT executes on the same connection (sees uncommitted data)

4. **Transaction Commit**: After the SELECT completes
   ```sql
   COMMIT;
   SET autocommit = 1;
   ```

5. **Error Handling**: If an error occurs, the interceptor's `finalize()` method:
   ```sql
   ROLLBACK;
   SET autocommit = 1;
   ```

### Why Transactions?

Transactions ensure that:
- Both INSERT and SELECT see the same data state
- The SELECT can see uncommitted data from the INSERT (within the same transaction)
- Atomicity: Both operations succeed or both fail

## ProxySQL Master/Replica Setup

### Configuration

When using ProxySQL with master/replica setup:

- **ProxySQL routes**:
  - Writes (INSERT/UPDATE/DELETE) → Master
  - Reads (SELECT) → Replicas (for load distribution)

### How Sticky Sessions Work

1. **Write Operation**:
   - `execute()` gets a connection from the pool
   - ProxySQL routes it to the **master**
   - Connection is stored in context

2. **Read Operation (after write)**:
   - `query()` checks `hasWrite() === true`
   - Uses the stored connection (bypasses ProxySQL routing)
   - Goes directly to the **master** (same connection as the write)
   - Sees the data immediately (no replication lag)

3. **Read Operation (no write)**:
   - `query()` checks `hasWrite() === false`
   - Uses the connection pool
   - ProxySQL routes to a **replica** (load distribution)

### Benefits

- ✅ **Read-after-write consistency**: No "not found" errors after creating records
- ✅ **Load distribution**: Reads without writes still use replicas
- ✅ **Performance**: No unnecessary delays or retries

## Single Database Instance

### How It Works

When using a single MySQL instance (no ProxySQL, no replicas):

- The sticky session mechanism still works
- All operations use the same database instance
- Transactions ensure consistency
- No performance penalty (same connection reuse)

### Benefits

- ✅ **Consistency**: Same guarantees as with ProxySQL
- ✅ **Future-proof**: Easy to add ProxySQL/replicas later without code changes
- ✅ **Transaction safety**: Explicit transactions prevent race conditions

## Definitions

### AsyncLocalStorage

A Node.js API that provides asynchronous context storage. It allows data to persist across asynchronous operations within a single execution context (e.g., a single HTTP request).

**Key Properties**:
- Isolated per request
- Automatically cleaned up when the request completes
- Thread-safe (each async context is independent)

### Connection Pool

A cache of database connections that can be reused across requests. Instead of creating a new connection for each query, connections are borrowed from the pool and returned when done.

**Benefits**:
- Performance: Reusing connections is faster than creating new ones
- Resource management: Limits the number of concurrent connections
- Load distribution: Pool can route to different database instances

### Master Database

The primary database instance that handles all write operations. Changes are written here first, then replicated to replicas.

### Replica Database

A read-only copy of the master database. Used for read operations to distribute load. Data is replicated from the master with some delay (replication lag).

### Replication Lag

The delay between when data is written to the master and when it becomes available on replicas. This can cause read-after-write consistency issues.

### Prepared Statement

A SQL statement that is pre-compiled by the database. Parameters are bound separately, providing:
- Performance: Query plan is cached
- Security: Protection against SQL injection
- Consistency: Same execution path for similar queries

### Transaction Isolation Level

Defines how transactions interact with each other. The application uses **READ COMMITTED**, which allows:
- Transactions to see committed changes from other transactions
- Uncommitted changes within the same transaction to be visible

## Best Practices

### When to Use `execute()` vs `query()`

- **Use `execute()`**: For INSERT, UPDATE, DELETE operations
- **Use `query()`**: For SELECT operations

### Connection Management

- Connections are automatically managed by the sticky session mechanism
- Don't manually acquire/release connections unless necessary
- The interceptor handles cleanup automatically

### Error Handling

- Errors in database operations are caught and handled by the repository layer
- Uncommitted transactions are automatically rolled back by the interceptor
- No manual transaction cleanup needed

## Troubleshooting

### Issue: "Employee created but could not be retrieved"

**Cause**: The SELECT query didn't see the INSERT, even on the same connection.

**Solution**: Ensure both operations use the same connection within a transaction. The current implementation handles this automatically.

### Issue: Connection not released

**Cause**: Error occurred before the interceptor's `finalize()` method ran.

**Solution**: The interceptor's cleanup handles this automatically, but ensure errors are properly caught and don't prevent cleanup.

### Issue: Transaction not committed

**Cause**: Error occurred between INSERT and SELECT.

**Solution**: The interceptor's `finalize()` method rolls back uncommitted transactions automatically.

## Summary

The database access architecture provides:

1. **Read-after-write consistency** through sticky sessions
2. **Automatic connection management** via AsyncLocalStorage
3. **Transaction safety** with explicit transaction handling
4. **ProxySQL compatibility** with master/replica setups
5. **Single database support** with the same guarantees
6. **No fallbacks** - the implementation ensures consistency without workarounds

This architecture ensures that your application works correctly whether you're using a single MySQL instance or a complex ProxySQL master/replica setup, without requiring code changes or fallback mechanisms.
