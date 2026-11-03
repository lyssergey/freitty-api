import type { DataSourceOptions } from 'typeorm';
import type { DatabaseConfig } from '../config/configuration.js';
import { resolveAppSchema } from './app-schema.js';
import { ENTITIES } from './entities.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

export type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/** Compiled migrations (`dist/database/migrations/*.js`); scripts always run from `dist`. */
const MIGRATIONS_GLOB = new URL('./migrations/*.js', import.meta.url).pathname;

/**
 * The one TypeORM configuration, used by the Nest app (`DatabaseModule`), the
 * TypeORM CLI and the db scripts (`data-source.ts`).
 *
 * The database is shared with other projects, so:
 * - every table — and TypeORM's own `migrations` table — lives in the app schema
 *   (`resolveAppSchema` throws for `public` or a non-identifier);
 * - no `synchronize`, no migrations on boot: schema changes are reviewed migrations;
 * - no `CREATE EXTENSION`: uuids come from core `gen_random_uuid()`.
 */
export function buildDataSourceOptions(db: DatabaseConfig): PostgresOptions {
  return {
    type: 'postgres',
    url: db.url,
    schema: resolveAppSchema(db.schema),
    applicationName: 'freitty-api',
    entities: ENTITIES,
    namingStrategy: new SnakeNamingStrategy(),
    migrations: [MIGRATIONS_GLOB],
    migrationsTableName: 'migrations',
    migrationsTransactionMode: 'all',
    migrationsRun: false,
    synchronize: false,
    dropSchema: false,
    installExtensions: false,
    uuidExtension: 'pgcrypto',
    // `true` = TLS with certificate verification (Neon presents a valid chain).
    ssl: db.ssl,
    logging: db.logging,
    // Small pool: serverless instances multiply it, Neon's pooler does the rest.
    extra: { max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 },
  };
}
