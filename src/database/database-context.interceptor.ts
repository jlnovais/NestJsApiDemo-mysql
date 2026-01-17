import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DatabaseContextService } from './database-context.service';

/**
 * Interceptor that initializes a database context for each request.
 * This enables sticky session behavior where reads after writes go to the master.
 * Also handles cleanup of connections when the request completes.
 */
@Injectable()
export class DatabaseContextInterceptor implements NestInterceptor {
  constructor(private readonly contextService: DatabaseContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Initialize the database context for this request
    // We need to run the entire Observable chain within the context
    return new Observable((subscriber) => {
      let teardown: (() => void) | undefined;

      this.contextService.run(() => {
        const source$ = next.handle();
        const cleanup = async (success: boolean): Promise<void> => {
          const connection = this.contextService.getConnection();
          if (!connection) return;

          try {
            // If a write occurred, execute() started a transaction (autocommit=0 + START TRANSACTION).
            // Keep it open during the request to force ProxySQL to keep the backend sticky (master),
            // then commit on success or rollback on error.
            if (this.contextService.hasWrite()) {
              if (success) {
                try {
                  await connection.query('COMMIT');
                } catch (commitErr) {
                  // If commit fails, try to rollback so we don't leave an open transaction.
                  await connection.query('ROLLBACK').catch(() => undefined);
                  throw commitErr;
                }
              } else {
                await connection.query('ROLLBACK');
              }
            }
          } finally {
            // Always re-enable autocommit and release the connection back to the pool.
            await connection.query('SET autocommit = 1').catch(() => undefined);
            connection.release();
          }
        };

        const subscription = source$.subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => {
            void cleanup(false)
              .catch((cleanupErr) => {
                // Keep the original error as the primary signal, but log cleanup failures.
                console.error('Error during DB rollback/cleanup:', cleanupErr);
              })
              .finally(() => subscriber.error(err));
          },
          complete: () => {
            void cleanup(true)
              .then(() => subscriber.complete())
              .catch((err) => {
                // If commit fails, surface it as a request error.
                subscriber.error(err);
              });
          },
        });

        teardown = () => subscription.unsubscribe();
      });

      return () => teardown?.();
    });
  }
}
