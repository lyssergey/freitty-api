import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  IsTimeZone,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { DEFAULT_APP_SCHEMA, resolveAppSchema } from '../database/app-schema.js';

/**
 * Runtime environment contract. `@nestjs/config` runs it on boot (and the CLI
 * scripts through `configuration()`), so a missing or malformed variable fails
 * fast with a readable message instead of deep inside a request.
 */
export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001;

  /** Comma-separated browser origins allowed by CORS. */
  @IsString()
  CORS_ORIGINS = 'http://localhost:3000';

  /**
   * Requests per minute per client IP, counted in memory (so per serverless
   * instance). Behind the front's rewrite proxy all visitors may share one bucket.
   */
  @IsInt()
  @Min(10)
  @Max(100_000)
  RATE_LIMIT_PER_MINUTE = 1000;

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  /** Postgres schema with all app tables (shared database). Checked by `resolveAppSchema`. */
  @IsString()
  DB_SCHEMA = DEFAULT_APP_SCHEMA;

  /** TLS with certificate verification (required by Neon). */
  @IsBoolean()
  DB_SSL = false;

  @IsBoolean()
  DB_LOGGING = false;

  /** Business time zone: "today", ISO weeks, activity buckets and CSV dates use it. */
  @IsTimeZone()
  APP_TIMEZONE = 'America/Toronto';

  /** Auth is out of scope: every request acts as this (seeded) user. */
  @IsEmail()
  DEMO_USER_EMAIL = 'user1@rway-transport.example';
}

const TRUTHY = ['1', 'true', 'yes', 'on'];

const toBool = (v: unknown): unknown =>
  typeof v === 'string' ? TRUTHY.includes(v.trim().toLowerCase()) : v;

const toInt = (v: unknown): unknown => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(
    EnvironmentVariables,
    {
      ...config,
      PORT: toInt(config.PORT),
      RATE_LIMIT_PER_MINUTE: toInt(config.RATE_LIMIT_PER_MINUTE),
      DB_SSL: toBool(config.DB_SSL),
      DB_LOGGING: toBool(config.DB_LOGGING),
    },
    { enableImplicitConversion: false, exposeDefaultValues: true },
  );

  const errors = validateSync(validated, { skipMissingProperties: false }).map(
    (e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
  );
  try {
    validated.DB_SCHEMA = resolveAppSchema(validated.DB_SCHEMA);
  } catch (err) {
    errors.push(`DB_SCHEMA: ${(err as Error).message}`);
  }
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n  ${errors.join('\n  ')}`);
  }
  return validated;
}
