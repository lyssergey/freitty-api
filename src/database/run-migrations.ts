import dataSource from './data-source.js';
import { ensureSchema } from './ensure-schema.js';

/**
 * Applies pending migrations (`npm run db:migrate`, and `vercel-build` before each
 * deploy). Kept out of the app bootstrap so a serverless cold start never runs DDL.
 */
async function run(): Promise<void> {
  await dataSource.initialize();
  try {
    // An empty list would report "up to date" and leave the database without tables.
    if (dataSource.migrations.length === 0) {
      throw new Error('no migrations registered — see src/database/migrations.ts');
    }
    const schema = await ensureSchema(dataSource);
    const applied = await dataSource.runMigrations({ transaction: 'all' });
    if (applied.length === 0) {
      console.log(`[migrations] schema "${schema}" is up to date — nothing to run`);
    } else {
      console.log(`[migrations] applied ${applied.length} to schema "${schema}":`);
      for (const migration of applied) console.log(`  - ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err: unknown) => {
  console.error('[migrations] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
