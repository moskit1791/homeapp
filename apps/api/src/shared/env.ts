import { z } from 'zod';

const defaultDatabaseUrl = 'postgres://postgres:postgres@localhost:5432/homeapp_dev';
const defaultAccessSecret = 'dev-access-secret-change-me-minimum-32';
const defaultRefreshSecret = 'dev-refresh-secret-change-me-minimum-32';
const defaultSmtpFrom = 'HomeApp <noreply@homeapp.local>';

const booleanEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const optionalStringList = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : undefined;
}, z.array(z.string().min(1)).optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default(defaultDatabaseUrl),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  AUTH_LINK_BASE_URL: z.string().url().default('homeapp://auth'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  GEMINI_API_KEY: optionalNonEmptyString,
  GEMINI_MODEL: optionalNonEmptyString.default('gemini-2.5-flash'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  GOOGLE_CALENDAR_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CALENDAR_CLIENT_SECRET: optionalNonEmptyString,
  GOOGLE_CALENDAR_REDIRECT_URI: optionalNonEmptyString,
  GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY: optionalNonEmptyString,
  GOOGLE_OAUTH_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_OAUTH_CLIENT_IDS: optionalStringList,
  JWT_ACCESS_SECRET: z.string().min(32).default(defaultAccessSecret),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_SECRET: z.string().min(32).default(defaultRefreshSecret),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  LOCAL_STORAGE_ROOT: z.string().default('./storage'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  PORT: z.coerce.number().int().positive().default(3000),
  SMTP_FROM: z.string().min(1).default(defaultSmtpFrom),
  SMTP_HOST: optionalNonEmptyString,
  SMTP_PASSWORD: optionalNonEmptyString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanEnv.default(false),
  SMTP_USER: optionalNonEmptyString,
  STORAGE_DRIVER: z.enum(['local']).default('local')
}).superRefine((env, context) => {
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SMTP_USER and SMTP_PASSWORD must be configured together',
      path: ['SMTP_USER']
    });
  }

  if (env.NODE_ENV !== 'production') {
    return;
  }

  const unsafeProductionValues: Array<[keyof AppEnv, boolean, string]> = [
    ['DATABASE_URL', env.DATABASE_URL === defaultDatabaseUrl, 'DATABASE_URL must be explicit in production'],
    ['APP_PUBLIC_URL', env.APP_PUBLIC_URL.includes('localhost'), 'APP_PUBLIC_URL must not point to localhost in production'],
    ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET === defaultAccessSecret, 'JWT_ACCESS_SECRET must be unique in production'],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET === defaultRefreshSecret, 'JWT_REFRESH_SECRET must be unique in production'],
    ['MAIL_DRIVER', env.MAIL_DRIVER !== 'smtp', 'MAIL_DRIVER must be smtp in production'],
    ['SMTP_FROM', env.SMTP_FROM === defaultSmtpFrom, 'SMTP_FROM must be explicit in production'],
    ['SMTP_HOST', !env.SMTP_HOST, 'SMTP_HOST must be configured in production']
  ];

  for (const [field, failed, message] of unsafeProductionValues) {
    if (failed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [field]
      });
    }
  }
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  return envSchema.parse(process.env);
}
