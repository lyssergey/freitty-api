/**
 * Applies pending migrations (`npm run db:migrate`, and the reseed workflow before it
 * seeds). Never part of the Vercel build or the app bootstrap: a deploy needs no
 * database access at build time, and a serverless cold start never runs DDL.
 *
 * Logs every step and gives up after MIGRATIONS_TIMEOUT_MS (90 s), so a stalled
 * database fails with a reason instead of hanging silently.
 */
const TIMEOUT_MS = Number(process.env.MIGRATIONS_TIMEOUT_MS) || 90_000;

let step = 'loading the configuration';

const log = (message: string): void => console.log(`[migrations] ${message}`);
const seconds = (since: number): string => ((Date.now() - since) / 1000).toFixed(1);

/** Host only, with a Neon endpoint id masked: `ep-…-pooler.eu-central-1.aws.neon.tech`. */
function describeHost(url: string | undefined): string {
  try {
    return new URL(url ?? '').hostname.replace(/^ep-[a-z0-9-]+?(-pooler)?\./, 'ep-…$1.');
  } catch {
    return 'an unparsable DATABASE_URL';
  }
}

async function run(): Promise<void> {
  const watchdog = setTimeout(() => {
    console.error(`[migrations] failed: no answer after ${TIMEOUT_MS / 1000} s while ${step}`);
    process.exit(1);
  }, TIMEOUT_MS);
  watchdog.unref();

  // Imported here, not at the top: a configuration error then ends in the same
  // "[migrations] failed: …" line as every other failure.
  const { default: dataSource } = await import('./data-source.js');
  const { ensureSchema } = await import('./ensure-schema.js');
  const options = dataSource.options as { url?: string; ssl?: unknown; schema?: string };

  const host = describeHost(options.url);
  step = `connecting to ${host}`;
  log(`connecting to ${host} (TLS ${options.ssl ? 'on' : 'off'}, schema "${options.schema}")`);
  const started = Date.now();
  await dataSource.initialize();
  log(`connected in ${seconds(started)} s`);

  try {
    // An empty list would report "up to date" and leave the database without tables.
    if (dataSource.migrations.length === 0) {
      throw new Error('no migrations registered — see src/database/migrations.ts');
    }
    step = 'creating the schema';
    const schema = await ensureSchema(dataSource);
    step = 'running the migrations';
    const applied = await dataSource.runMigrations({ transaction: 'all' });
    if (applied.length === 0) {
      log(`schema "${schema}" is up to date — nothing to run`);
    } else {
      log(`applied ${applied.length} to schema "${schema}":`);
      for (const migration of applied) console.log(`  - ${migration.name}`);
    }
  } finally {
    step = 'closing the connection';
    await dataSource.destroy();
  }
}

run().catch((err: unknown) => {
  console.error('[migrations] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
