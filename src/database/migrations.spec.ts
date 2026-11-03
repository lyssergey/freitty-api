import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from './data-source-options.js';
import { MIGRATIONS } from './migrations.js';

// Every file, whatever its name: `migration:generate` writes `<timestamp>-<name>.ts`
// with the class `<Name><timestamp>` (TypeORM camel-cases the name).
const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url);
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
  .sort();

describe('MIGRATIONS', () => {
  it('registers the class of every file in src/database/migrations', async () => {
    const registered = new Set<unknown>(MIGRATIONS);
    expect(MIGRATIONS).toHaveLength(migrationFiles.length);
    for (const file of migrationFiles) {
      const exported = Object.values(await import(new URL(file, MIGRATIONS_DIR).href));
      expect(
        exported.some((value) => registered.has(value)),
        file,
      ).toBe(true);
    }
  });

  it('lists them oldest first, by the timestamp TypeORM reads from the class name', () => {
    const timestamps = MIGRATIONS.map((migration) => Number(/\d{13}$/.exec(migration.name)?.[0]));
    expect(timestamps.every(Number.isInteger)).toBe(true);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it('is what the data source loads: classes, not a glob', () => {
    const options = buildDataSourceOptions({
      url: 'postgres://user:pass@localhost:5432/db',
      schema: 'freitty',
      ssl: false,
      logging: false,
    });
    expect(options.migrations).toBe(MIGRATIONS);
  });
});
