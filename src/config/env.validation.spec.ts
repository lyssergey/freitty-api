import { describe, expect, it } from 'vitest';
import { resolveAppSchema } from '../database/app-schema.js';
import { configuration } from './configuration.js';
import { validateEnv } from './env.validation.js';

const base = { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' };

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv({ ...base });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      RATE_LIMIT_PER_MINUTE: 1000,
      DB_SCHEMA: 'freitty',
      DB_SSL: false,
      APP_TIMEZONE: 'America/Toronto',
      DEMO_USER_EMAIL: 'user1@rway-transport.example',
    });
  });

  it('coerces numbers and boolean-ish strings', () => {
    const env = validateEnv({
      ...base,
      PORT: '4000',
      RATE_LIMIT_PER_MINUTE: '300',
      DB_SSL: 'true',
      DB_LOGGING: '0',
    });
    expect([env.PORT, env.RATE_LIMIT_PER_MINUTE, env.DB_SSL, env.DB_LOGGING]).toEqual([
      4000,
      300,
      true,
      false,
    ]);
  });

  it('bounds the rate limit', () => {
    for (const value of ['0', '9', '100001', '12.5', 'many']) {
      expect(() => validateEnv({ ...base, RATE_LIMIT_PER_MINUTE: value })).toThrow(
        /RATE_LIMIT_PER_MINUTE/,
      );
    }
  });

  it('requires DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuses the shared public schema and non-identifiers', () => {
    expect(() => validateEnv({ ...base, DB_SCHEMA: 'public' })).toThrow(/DB_SCHEMA/);
    expect(() => validateEnv({ ...base, DB_SCHEMA: 'freitty"; DROP' })).toThrow(/DB_SCHEMA/);
  });

  it('rejects an unknown time zone and a bad port', () => {
    expect(() => validateEnv({ ...base, APP_TIMEZONE: 'Mars/Olympus' })).toThrow(/APP_TIMEZONE/);
    expect(() => validateEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });
});

describe('resolveAppSchema', () => {
  it('defaults to freitty and accepts dedicated schemas', () => {
    expect(resolveAppSchema(undefined)).toBe('freitty');
    expect(resolveAppSchema('  ')).toBe('freitty');
    expect(resolveAppSchema('freitty_test')).toBe('freitty_test');
  });

  it('throws for public, system schemas and anything that needs quoting', () => {
    for (const schema of ['public', 'pg_catalog', 'information_schema', 'Freitty', 'a-b', '1abc']) {
      expect(() => resolveAppSchema(schema)).toThrow();
    }
  });
});

describe('configuration', () => {
  it('maps the env into the typed tree', () => {
    const { app } = configuration({
      ...base,
      CORS_ORIGINS: 'http://localhost:3000, https://freitty.example ',
      DB_SSL: 'true',
      DEMO_USER_EMAIL: 'User1@RWay-Transport.example',
    });
    expect(app.corsOrigins).toEqual(['http://localhost:3000', 'https://freitty.example']);
    expect(app.rateLimitPerMinute).toBe(1000);
    expect(app.database).toEqual({
      url: base.DATABASE_URL,
      schema: 'freitty',
      ssl: true,
      logging: false,
    });
    expect(app.demoUserEmail).toBe('user1@rway-transport.example');
  });
});
