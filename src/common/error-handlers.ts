import {
  ConflictException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CONNECTION_ERROR_CODES,
  CONNECTION_ERROR_ERRNOS,
  RETURN_DATABASE_ERROR_CODES,
} from './error-codes';
import { ResultNoData, ResultWithData, PaginationResult } from './result';

/**
 * Interface for error handling result
 */
export interface DatabaseErrorResult {
  Success: boolean;
  Message: string;
  ErrorCode: number;
}

/**
 * Generic function to handle database errors and return a standardized error result
 * @param error - The error object caught from database operations
 * @param defaultMessage - Default message to use if error doesn't have a message
 * @returns DatabaseErrorResult object that can be used to initialize ResultWithData or ResultNoData
 */
export function handleDatabaseError(
  error: unknown,
  defaultMessage: string = 'Database operation failed',
): DatabaseErrorResult {
  const result: DatabaseErrorResult = {
    Success: false,
    Message: error instanceof Error ? error.message : defaultMessage,
    ErrorCode: RETURN_DATABASE_ERROR_CODES.OTHER_ERROR,
  };

  // distinguish error types
  if (error && typeof error === 'object' && 'code' in error) {
    const mysqlError = error as { code?: string; errno?: number };

    // database connection errors (-1)
    const isConnectionError =
      (mysqlError.code && CONNECTION_ERROR_CODES.includes(mysqlError.code)) ||
      (mysqlError.errno && CONNECTION_ERROR_ERRNOS.includes(mysqlError.errno));

    if (isConnectionError) {
      result.ErrorCode = RETURN_DATABASE_ERROR_CODES.CONNECTION_ERROR;
      result.Message = 'Database connection error';
    }
    // duplicated values (-2)
    else if (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062) {
      result.ErrorCode = RETURN_DATABASE_ERROR_CODES.DUPLICATE_ENTRY;
      result.Message = 'Duplicate entry';
    }
    // other errors (-999)
    else {
      result.ErrorCode = RETURN_DATABASE_ERROR_CODES.OTHER_ERROR;
    }
  } else {
    result.ErrorCode = RETURN_DATABASE_ERROR_CODES.OTHER_ERROR;
  }

  return result;
}

/**
 * Converts repository result errors to HTTP exceptions
 * @param result - The result object from repository operations
 * @throws HttpException based on the error code
 */
export function handleRepositoryError(
  result: ResultWithData<any> | ResultNoData | PaginationResult<any>,
): void {
  if (!result.Success) {
    switch (result.ErrorCode) {
      case RETURN_DATABASE_ERROR_CODES.DUPLICATE_ENTRY:
        throw new ConflictException(result.Message);
      case RETURN_DATABASE_ERROR_CODES.CONNECTION_ERROR:
        throw new ServiceUnavailableException(result.Message);
      default:
        throw new HttpException(
          result.Message,
          result.ErrorCode < 0
            ? HttpStatus.INTERNAL_SERVER_ERROR.valueOf()
            : result.ErrorCode.valueOf(),
        );
    }
  }
}
