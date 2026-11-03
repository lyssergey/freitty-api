import { validateEnv, type EnvironmentVariables } from './env.validation.js';

/** Shape of the whole config tree, consumed via `ConfigService<RootConfig, true>`. */
export interface RootConfig {
  app: AppConfig;
}

export interface AppConfig {
  nodeEnv: EnvironmentVariables['NODE_ENV'];
  port: number;
  corsOrigins: string[];
  /** Requests per minute per client IP (per instance). */
  rateLimitPerMinute: number;
  /** IANA zone used for business dates (filters, activity buckets, CSV). */
  timezone: string;
  demoUserEmail: string;
  database: DatabaseConfig;
}

export interface DatabaseConfig {
  url: string;
  /** Always a dedicated schema, never `public` (validated). */
  schema: string;
  ssl: boolean;
  logging: boolean;
}

/**
 * Maps the validated, flat env into the typed config tree. Shared by the Nest app
 * (`ConfigModule.load`) and the standalone scripts (migrations, seed, TypeORM CLI),
 * so both read the database settings exactly the same way.
 */
export function configuration(env: Record<string, unknown> = process.env): RootConfig {
  const vars = validateEnv(env);
  return {
    app: {
      nodeEnv: vars.NODE_ENV,
      port: vars.PORT,
      corsOrigins: vars.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      rateLimitPerMinute: vars.RATE_LIMIT_PER_MINUTE,
      timezone: vars.APP_TIMEZONE,
      demoUserEmail: vars.DEMO_USER_EMAIL.trim().toLowerCase(),
      database: {
        url: vars.DATABASE_URL,
        schema: vars.DB_SCHEMA,
        ssl: vars.DB_SSL,
        logging: vars.DB_LOGGING,
      },
    },
  };
}
