import 'reflect-metadata'; // class-transformer's @Type reads design-time metadata
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListOrdersQuery } from './order-filters.query.js';

/** Fields that fail validation, transformed and validated like the global ValidationPipe does. */
function invalidFields(query: Record<string, string>): string[] {
  const dto = plainToInstance(ListOrdersQuery, query);
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);
}

describe('ListOrdersQuery', () => {
  it('accepts a search and the largest page', () => {
    expect(invalidFields({ q: ' #001812 ', page: '100000', pageSize: '100' })).toEqual([]);
    expect(plainToInstance(ListOrdersQuery, { q: ' #001812 ' }).q).toBe('#001812');
  });

  it('rejects a NUL byte in q (Postgres refuses it in text)', () => {
    expect(invalidFields({ q: '\u0000' })).toEqual(['q']);
    expect(invalidFields({ q: 'FR001\u0000' })).toEqual(['q']);
  });

  it('caps page at 100,000, like the front (1e20 would overflow the SQL OFFSET)', () => {
    expect(invalidFields({ page: '1e20' })).toEqual(['page']);
    expect(invalidFields({ page: '100001' })).toEqual(['page']);
  });
});
