// Vercel serverless entry. Re-exports the Nest handler compiled by `nest build`
// (tsc keeps decorator metadata, which Nest DI and TypeORM rely on). Vercel only
// bundles the already-compiled `dist`, so nothing is re-transpiled here.
export { default } from '../dist/serverless.js';
