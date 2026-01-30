type EnvLike = Record<string, unknown>;

function emptyToUndefined(value: unknown): unknown {
  if (value === '') return undefined;
  return value;
}

function toOptionalNumber(value: unknown): number | undefined {
  const v = emptyToUndefined(value);
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  const v = emptyToUndefined(value);
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return Boolean(v);
}

export function validateEnv(config: EnvLike): EnvLike {
  const next: EnvLike = { ...config };

  const stringKeys = [
    'NODE_ENV',
    'SESSION_SECRET',
    'RABBITMQ_HOST',
    'RABBITMQ_HOST_SENDER',
    'RABBITMQ_HOST_CONSUMER',
    'RABBITMQ_USER',
    'RABBITMQ_USER_SENDER',
    'RABBITMQ_USER_CONSUMER',
    'RABBITMQ_PASSWORD',
    'RABBITMQ_PASSWORD_SENDER',
    'RABBITMQ_PASSWORD_CONSUMER',
    'RABBITMQ_VHOST',
    'RABBITMQ_VHOST_SENDER',
    'RABBITMQ_VHOST_CONSUMER',
    'RABBITMQ_CONNECTION_DESCRIPTION',
    'RABBITMQ_CONNECTION_DESCRIPTION_SENDER',
    'RABBITMQ_CONNECTION_DESCRIPTION_CONSUMER',
    'RABBITMQ_RETRY_QUEUE',
    'RABBITMQ_EMPLOYEE_EVENTS_QUEUE',
    'DB_HOST',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
    'REDIS_HOST',
    'REDIS_PASSWORD',
    'OCI_REGION',
    'OCI_ACCESS_KEY_ID',
    'OCI_SECRET_ACCESS_KEY',
    'OCI_S3_ENDPOINT',
    'OCI_BUCKET_NAME',
    'OCI_NAMESPACE',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_HOST',
    'SMTP_FROM',
  ] as const;

  const numberKeys = [
    'PORT',
    'SESSION_EXPIRY_MINUTES',
    'RABBITMQ_PORT',
    'RABBITMQ_PORT_SENDER',
    'RABBITMQ_PORT_CONSUMER',
    'RABBITMQ_CONNECTION_TIMEOUT',
    'RABBITMQ_CONNECTION_TIMEOUT_SENDER',
    'RABBITMQ_CONNECTION_TIMEOUT_CONSUMER',
    'RABBITMQ_CONNECTION_RETRY_DELAY',
    'RABBITMQ_CONNECTION_RETRY_DELAY_SENDER',
    'RABBITMQ_CONNECTION_RETRY_ATTEMPTS',
    'RABBITMQ_CONNECTION_RETRY_ATTEMPTS_SENDER',
    'RABBITMQ_MAX_CHANNELS_PER_CONNECTION',
    'RABBITMQ_RETRY_QUEUE_MESSAGE_TTL_IN_SECONDS_MIN',
    'RABBITMQ_RETRY_QUEUE_MESSAGE_TTL_IN_SECONDS_MAX',
    'DB_PORT',
    'REDIS_PORT',
    'REDIS_DB',
    'SMTP_PORT',
    'CODE_EXPIRY_MINUTES',
    'RABBITMQ_CONSUMER_INSTANCES_TO_START',
    'RABBITMQ_CONSUMER_MAX_RECONNECT_ATTEMPTS',
    'CACHE_TTL_SECONDS',
  ] as const;

  const booleanKeys = [
    'RABBITMQ_SELECT_RANDOM_HOST',
    'RABBITMQ_SELECT_RANDOM_HOST_SENDER',
    'RABBITMQ_SELECT_SEQUENCIAL_HOST',
    'RABBITMQ_SELECT_SEQUENCIAL_HOST_SENDER',
    'RABBITMQ_USE_RETRY_COUNT_FOR_REQUED_MESSAGES',
    'REDIS_ENABLED',
    'RABBITMQ_CONSUMER_ENABLED',
    'CACHE_ENABLED',
  ] as const;

  for (const key of stringKeys) next[key] = emptyToUndefined(next[key]);
  for (const key of numberKeys) next[key] = toOptionalNumber(next[key]);
  for (const key of booleanKeys) next[key] = toOptionalBoolean(next[key]);

  return next;
}
