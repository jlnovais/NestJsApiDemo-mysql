import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { PoolConnection } from 'mysql2/promise';

interface DatabaseContext {
  hasWrite: boolean;
  connection?: PoolConnection;
}

/**
 * Service to manage database context per request using AsyncLocalStorage.
 * This enables "sticky sessions" where reads after writes go to the master database
 * to avoid replication lag issues with ProxySQL.
 */
@Injectable()
export class DatabaseContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<DatabaseContext>();

  /**
   * Run a function within a database context.
   * This should be called at the start of each request.
   */
  run<T>(callback: () => T): T {
    const context: DatabaseContext = {
      hasWrite: false,
    };
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current database context.
   * Returns undefined if called outside of a context.
   */
  getContext(): DatabaseContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Mark that a write operation has occurred in the current context.
   * This will cause subsequent reads to use the master connection.
   */
  markWrite(connection?: PoolConnection): void {
    const context = this.getContext();
    if (context) {
      context.hasWrite = true;
      if (connection) {
        context.connection = connection;
      }
    }
  }

  /**
   * Check if a write operation has occurred in the current context.
   */
  hasWrite(): boolean {
    const context = this.getContext();
    return context?.hasWrite ?? false;
  }

  /**
   * Get the connection stored in the context (if any).
   * This is the connection used for the write operation.
   */
  getConnection(): PoolConnection | undefined {
    const context = this.getContext();
    return context?.connection;
  }

  /**
   * Set a connection in the context for subsequent operations.
   */
  setConnection(connection: PoolConnection): void {
    const context = this.getContext();
    if (context) {
      context.connection = connection;
    }
  }
}
