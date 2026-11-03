import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from './data-source-options.js';

describe('buildDataSourceOptions', () => {
  it('hands TypeORM the pg driver, so serverless bundles trace and include it', () => {
    const options = buildDataSourceOptions({
      url: 'postgres://user:pass@localhost:5432/db',
      schema: 'freitty',
      ssl: false,
      logging: false,
    });
    expect(options.driver).toBe(pg);
  });
});
