import type { DataSource } from 'typeorm';
import { resolveAppSchema } from './app-schema.js';

/**
 * Creates the app schema if it does not exist yet (idempotent). TypeORM creates
 * tables — and its `migrations` table — inside `schema` but never the schema
 * itself. Called by the migration runner only, never on a request path.
 */
export async function ensureSchema(dataSource: DataSource): Promise<string> {
  const options = dataSource.options as { schema?: string };
  const schema = resolveAppSchema(options.schema);
  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  return schema;
}
