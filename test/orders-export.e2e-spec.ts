import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatZonedDate, formatZonedDateTime } from '../src/common/time/zoned-time.js';
import { tableName } from '../src/database/table-name.js';
import { Order } from '../src/modules/orders/entities/order.entity.js';
import { ORDERS_CSV_HEADER } from '../src/modules/orders/orders-csv.js';
import { createE2eApp, get } from './e2e-app.js';
import { numbers, seededDataset, TIME_ZONE } from './seeded.js';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Keeps the raw bytes, so the BOM and the line endings are checked as sent. */
function rawBody(res: Response, done: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
}

describe('GET /api/orders/export (e2e)', () => {
  let app: INestApplication;
  const dataset = seededDataset();
  const scheduled = (number: string) =>
    formatZonedDateTime(dataset.orders.find((o) => o.number === number)!.scheduledAt!, TIME_ZONE);

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** The CSV lines for `query` (header first), after checking the BOM and CRLF endings. */
  async function exportLines(query: string): Promise<string[]> {
    const res = await get(app, `/api/orders/export?${query}`)
      .buffer(true)
      .parse(rawBody)
      .expect(200);
    const body = res.body as Buffer;
    expect(body.subarray(0, BOM.length)).toEqual(BOM);
    const text = body.subarray(BOM.length).toString('utf8');
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/); // no bare LF or CR
    return text.slice(0, -2).split('\r\n');
  }

  const orderNumbers = (lines: string[]) => lines.slice(1).map((line) => line.split(',')[0]);

  it('downloads the filtered list as a dated CSV attachment, one row per order', async () => {
    const res = await get(app, '/api/orders/export').buffer(true).parse(rawBody).expect(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    const today = formatZonedDate(new Date(), TIME_ZONE);
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="freitty-orders-${today}.csv"`,
    );

    const lines = await exportLines('');
    expect(lines[0]).toBe(ORDERS_CSV_HEADER.join(','));
    const list = await get(app, '/api/orders?pageSize=100').expect(200);
    expect(lines).toHaveLength(list.body.total + 1);
    expect(orderNumbers(lines)).toEqual(numbers(list.body.items)); // the list's order
  });

  it('exports every order of a filter, past the list page size', async () => {
    const all = await get(app, '/api/orders?period=all').expect(200);
    expect(await exportLines('period=all')).toHaveLength(all.body.total + 1);
    expect(orderNumbers(await exportLines('status=in_progress'))).toEqual([
      'FR001676',
      'FR001674',
      'FR001383',
    ]);
  });

  it('writes the cells like the cards, quoting fields with commas', async () => {
    const lines = await exportLines('');
    const row = (number: string) => lines.find((line) => line.startsWith(`${number},`));
    expect(row('FR001676')).toBe(
      `FR001676,Consolidation,In progress,"REF-1001, REF-1003, REF-1002",Markham,,` +
        `${scheduled('FR001676')},"Toronto, ON",15 × Std + 12 × XL,Driver: User 5,User 1,Loading,,`,
    );
    expect(row('FR001672')).toBe(
      `FR001672,Cross-Dock,Completed,REF-1007,Markham,,${scheduled('FR001672')},` +
        `"Brampton, ON · Order with photos",10 × XL,Self pickup,User 1,,#001812,464.00`,
    );
    expect(row('DRAFT-003')).toBe(
      `DRAFT-003,Consolidation,Draft,,Markham,,${scheduled('DRAFT-003')},,,,User 1,,,`,
    );
  });

  it('neutralises cells a spreadsheet would run as formulas', async () => {
    // No seeded value starts with = + - @, so plant two (raw SQL keeps updated_at as
    // seeded) and restore the originals afterwards.
    const dataSource = app.get(DataSource);
    const setRefAndDestination = (ref: string, destination: string) =>
      dataSource.query(
        `UPDATE ${tableName(dataSource, Order)} SET ref_number = $1, destination = $2 WHERE number = $3`,
        [ref, destination, 'FR001383'],
      );
    await setRefAndDestination('-1012', '=1+2');
    try {
      const [, row] = await exportLines('q=FR001383');
      expect(row!.split(',').slice(0, 8)).toEqual([
        'FR001383',
        'Cross-Dock',
        'In progress',
        "'-1012",
        'Markham',
        '',
        scheduled('FR001383'),
        "'=1+2",
      ]);
    } finally {
      const seeded = dataset.orders.find((o) => o.number === 'FR001383')!;
      await setRefAndDestination(seeded.refNumber!, seeded.destination!);
    }
  });

  it('takes the list filters but no paging', async () => {
    await get(app, '/api/orders/export?page=1').expect(400);
    await get(app, '/api/orders/export?q=%00').expect(400);
  });
});
