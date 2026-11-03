/** Default Postgres schema that holds every table of this app. */
export const DEFAULT_APP_SCHEMA = 'freitty';

/** A plain, unquoted Postgres identifier — safe to interpolate into DDL. */
export const SCHEMA_NAME_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

/** Schemas this app must never own: other apps' tables (and their `migrations`) live in `public`. */
const FORBIDDEN_SCHEMAS = /^(public|information_schema|pg_.*)$/;

/**
 * Resolves `DB_SCHEMA` (default `freitty`). The database is shared with other
 * projects, so TypeORM — which also keeps its `migrations` table in this schema —
 * must never be pointed at `public` or a system schema. Throws instead of
 * guessing: a wrong schema here means DDL in somebody else's tables.
 */
export function resolveAppSchema(value: string | undefined): string {
  const schema = value?.trim() || DEFAULT_APP_SCHEMA;
  if (!SCHEMA_NAME_PATTERN.test(schema)) {
    throw new Error(`DB_SCHEMA "${schema}" must be a plain lower-case identifier`);
  }
  if (FORBIDDEN_SCHEMAS.test(schema)) {
    throw new Error(
      `DB_SCHEMA "${schema}" is not allowed: the database is shared, use a dedicated schema`,
    );
  }
  return schema;
}
