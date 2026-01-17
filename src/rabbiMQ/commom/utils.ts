import { LoggerWrapper } from '../commom/types';

interface WriteLogOptions {
  error?: Error;
  writeToConsole?: boolean;
}

export function WriteLog(
  logger: LoggerWrapper | null,
  type: 'error' | 'warn' | 'info',
  message: string,
  options: WriteLogOptions = {},
): void {
  const { error, writeToConsole = true } = options;

  if (!logger) {
    return;
  }

  switch (type) {
    case 'error':
      if (writeToConsole) console.error(message, error);
      logger.error(message, error);
      break;
    case 'warn':
      if (writeToConsole) console.warn(message);
      logger.warn(message);
      break;
    case 'info':
      if (writeToConsole) console.info(message);
      logger.info(message);
      break;
  }
}
