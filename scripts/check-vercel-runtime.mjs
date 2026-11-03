// Loads the compiled serverless entry the way Vercel's runtime does: without
// Node's native require(ESM). Run with `node --no-experimental-require-module`.
// Nest 12 is ESM-only, so any CommonJS dependency that require()s a Nest package
// would crash the deployed function with ERR_REQUIRE_ESM — this catches it first.
// Importing the module evaluates every static import; nothing connects to the DB.
process.env.NODE_ENV ??= 'production';
process.env.DATABASE_URL ??= 'postgres://check:check@localhost:1/check';
process.env.DB_SCHEMA ??= 'freitty';

try {
  const mod = await import('../dist/serverless.js');
  if (typeof mod.default !== 'function')
    throw new Error('dist/serverless.js has no default handler');
  console.log('[check:vercel-runtime] ok — serverless handler loads without require(ESM)');
} catch (err) {
  console.error('[check:vercel-runtime] FAILED:', err?.code ?? '', err?.message ?? err);
  process.exit(1);
}
