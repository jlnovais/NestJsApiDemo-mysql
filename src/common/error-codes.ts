/**
 * Database error codes
 * These constants are used to identify different types of database errors
 */
export const RETURN_DATABASE_ERROR_CODES = {
  /** Database connection errors (e.g., connection refused, timeout, access denied) */
  CONNECTION_ERROR: -1,
  /** Duplicate entry errors (e.g., unique constraint violation) */
  DUPLICATE_ENTRY: -2,
  /** Other/unknown database errors */
  OTHER_ERROR: -999,
} as const;

export const CONNECTION_ERROR_CODES = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ECONNRESET',
];

export const CONNECTION_ERROR_ERRNOS = [
  2002, // Can't connect to MySQL server
  2003, // Can't connect to MySQL server
  1045, // Access denied
  1049, // Unknown database
];
