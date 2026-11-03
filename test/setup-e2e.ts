import { DataSource } from 'typeorm';
import { afterAll, beforeAll, vi } from 'vitest';
import { configuration } from '../src/config/configuration.js';
import { buildDataSourceOptions } from '../src/database/data-source-options.js';
import { ensureSchema } from '../src/database/ensure-schema.js';
import { seedDatabase } from '../src/database/seeds/seed-database.js';

/**
 * Runs before every e2e file. The env below fully defines the app config (the app
 * ignores .env when NODE_ENV=test, see app.module.ts), then the test database gets
 * the real migrations and the real demo dataset, exactly like `db:migrate` and
 * `db:seed` do it. The seed TRUNCATEs every app table, so DATABASE_URL must be the
 * throwaway test database (docker-compose.test.yml, or the CI service).
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5433/freitty_test';
assertLocalDatabase(process.env.DATABASE_URL);
Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_SCHEMA: 'freitty',
  DB_SSL: 'false',
  DB_LOGGING: 'false',
  APP_TIMEZONE: 'America/Toronto',
  DEMO_USER_EMAIL: 'user1@rway-transport.example',
  CORS_ORIGINS: 'http://localhost:3000',
  RATE_LIMIT_PER_MINUTE: '1000',
});

// The seed and the API both take "now" from Date. Pin it to one instant per file,
// so a run that crosses local midnight still sees the day it seeded; E2E_NOW
// replays another instant (e.g. a DST night). Only Date is faked, not timers.
const now = process.env.E2E_NOW ? new Date(process.env.E2E_NOW) : new Date();
if (Number.isNaN(now.getTime())) throw new Error(`E2E_NOW is not a date: ${process.env.E2E_NOW}`);
vi.setSystemTime(now);

beforeAll(async () => {
  const { database, timezone } = configuration().app;
  const dataSource = new DataSource(buildDataSourceOptions(database));
  try {
    await dataSource.initialize();
  } catch (err) {
    throw new Error('Cannot reach the e2e database: start it with `npm run db:test:up`', {
      cause: err,
    });
  }
  try {
    await ensureSchema(dataSource);
    await dataSource.runMigrations({ transaction: 'all' });
    await seedDatabase(dataSource, now, timezone);
  } finally {
    await dataSource.destroy();
  }
});

afterAll(() => {
  vi.useRealTimers();
});

/** Anything but a database on this machine is refused: the seed empties every app table. */
function assertLocalDatabase(url: string): void {
  let host: string | null = null;
  try {
    const parsed = new URL(url);
    // pg lets `?host=` / `?hostaddr=` override the host of the URL.
    const overridden = parsed.searchParams.has('host') || parsed.searchParams.has('hostaddr');
    host = overridden ? null : parsed.hostname;
  } catch {
    // not a URL (e.g. a socket path): refused below
  }
  if (!host || !LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run the e2e tests: DATABASE_URL must point at localhost or 127.0.0.1` +
        `${host ? ` (got "${host}")` : ''}, since the setup truncates every app table. ` +
        'Start the test database with `npm run db:test:up`.',
    );
  }
}
