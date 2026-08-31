const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'BINANCE_KEY_ENCRYPTION_KEY',
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

function readRequiredEnv(name: RequiredEnvVar): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Set it before starting the API; see .env.example.`,
    );
  }
  return value;
}

export function validateRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name] || process.env[name]?.trim() === '',
  );
  if (missing.length === 0) return;

  throw new Error(
    [
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
      'There is no fallback secret: the API refuses to start until every required variable is set.',
      'See .env.example, set the missing values, and start again.',
    ].join(' '),
  );
}

export function getJwtSecret(): string {
  return readRequiredEnv('JWT_SECRET');
}

export function getJwtRefreshSecret(): string {
  return readRequiredEnv('JWT_REFRESH_SECRET');
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '15m';
}

export function getJwtRefreshExpiresIn(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN || '7d';
}
