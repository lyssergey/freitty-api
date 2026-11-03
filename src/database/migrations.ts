import { InitialSchema1793710246120 } from './migrations/1793710246120-InitialSchema.js';

/**
 * Every migration, oldest first. Class references, never a glob (like `ENTITIES`):
 * a glob path built from `import.meta.url` matches nothing when the checkout path
 * has spaces or non-ASCII characters, and TypeORM then silently runs no migration.
 * Append each migration produced by `npm run migration:generate` here.
 */
export const MIGRATIONS = [InitialSchema1793710246120];
