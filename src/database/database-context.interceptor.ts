import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
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
      this.contextService.run(() => {
        const source$ = next.handle();
        source$
          .pipe(
            finalize(() => {
              // Clean up: release the connection when the request completes
              // This runs within the AsyncLocalStorage context
              const connection = this.contextService.getConnection();
              if (connection) {
                // Rollback any uncommitted transaction before releasing
                // This handles cases where an error occurred before commit
                connection
                  .query('ROLLBACK')
                  .catch(() => {
                    // Ignore rollback errors (might not be in a transaction or already committed)
                  })
                  .then(() => {
                    // Re-enable autocommit in case it was disabled
                    return connection.query('SET autocommit = 1').catch(() => {
                      // Ignore errors
                    });
                  })
                  .then(() => {
                    connection.release();
                  })
                  .catch((error) => {
                    // Ignore errors during cleanup
                    console.error('Error releasing connection:', error);
                  });
              }
            }),
          )
          .subscribe({
            next: (value) => {
              subscriber.next(value);
            },
            error: (error) => {
              subscriber.error(error);
            },
            complete: () => {
              subscriber.complete();
            },
          });
      });
    });
  }
}
