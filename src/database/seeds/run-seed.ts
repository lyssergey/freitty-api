import 'reflect-metadata';
import 'dotenv/config';
import { configuration } from '../../config/configuration.js';
import { resolveAppSchema } from '../app-schema.js';
import dataSource from '../data-source.js';
import { seedDatabase } from './seed-database.js';

/**
 * `npm run db:seed` — replaces all app data with the demo dataset for the current
 * time (see `seedDatabase`). Refuses to run unless DB_SCHEMA is explicitly set to
 * a dedicated schema: the database is shared.
 */
async function run(): Promise<void> {
  if (!process.env.DB_SCHEMA?.trim()) {
    throw new Error('Refusing to seed: set DB_SCHEMA to the app schema (e.g. DB_SCHEMA=freitty)');
  }
  const schema = resolveAppSchema(process.env.DB_SCHEMA); // throws for public / system schemas
  const { timezone } = configuration().app;
  const now = new Date();

  await dataSource.initialize();
  try {
    const summary = await seedDatabase(dataSource, now, timezone);
    console.log(`[seed] schema "${schema}" seeded (${timezone}):`);
    for (const { table, rows } of summary) console.log(`  ${table.padEnd(16)} ${rows}`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err: unknown) => {
  console.error('[seed] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
