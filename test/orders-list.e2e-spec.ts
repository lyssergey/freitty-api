import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrderRow } from '../src/database/seeds/seed-types.js';
import { createE2eApp, get } from './e2e-app.js';
import { FEATURED_LIST_ORDER, numbers, seededDataset, seededOrders } from './seeded.js';

/** Tab counts of seeded orders; alerts, drafts and attention come from the featured orders only. */
const tabCounts = (orders: OrderRow[]) => ({
  all: orders.length,
  cross_dock: orders.filter((o) => o.type === 'cross_dock').length,
  consolidation: orders.filter((o) => o.type === 'consolidation').length,
  alerts: 1,
  drafts: 1,
  attention: 3,
});

describe('GET /api/orders (e2e)', () => {
  let app: INestApplication;
  const dataset = seededDataset();
  const last30d = seededOrders(dataset, '30d');
  const list = (query: string) => get(app, `/api/orders?${query}`).expect(200);

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns page 1 of the last 30 days, newest activity first, with the tab counts', async () => {
    const res = await get(app, '/api/orders').expect(200);
    expect(numbers(res.body.items)).toEqual(numbers(last30d.slice(0, 12)));
    expect(numbers(res.body.items).slice(0, 10)).toEqual(FEATURED_LIST_ORDER);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 12,
      total: last30d.length,
      pageCount: Math.ceil(last30d.length / 12),
      counts: tabCounts(last30d),
    });
  });

  it('maps a card with sub-orders, cargo per unit, an open alert and a client action', async () => {
    const res = await list('segment=alerts');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      number: 'FR001674',
      type: 'consolidation',
      status: 'in_progress',
      hub: { code: 'MAR', name: 'Markham' },
      subOrders: [
        {
          number: 'FR001674-1',
          refNumber: 'REF-1005',
          declaredQty: 12,
          actualQty: 11,
          alert: null,
        },
        {
          number: 'FR001674-2',
          refNumber: 'REF-1006',
          declaredQty: 8,
          actualQty: 7,
          alert: { kind: 'photo_missing' },
        },
      ],
      cargo: [{ unitType: 'standard', declared: 20, actual: 18 }],
      carrier: { mode: 'carrier', name: 'TForce' },
      nextAction: { kind: 'upload_photo', requiresClient: true },
      openAlerts: [{ kind: 'photo_missing', subOrderNumber: 'FR001674-2' }],
      invoice: null,
    });
  });

  it('filters by segment', async () => {
    const attention = await list('segment=attention');
    expect(numbers(attention.body.items)).toEqual(['FR001674', 'FR001679', 'FR001677']);
    const drafts = await list('segment=drafts');
    expect(numbers(drafts.body.items)).toEqual(['DRAFT-003']);

    for (const type of ['cross_dock', 'consolidation'] as const) {
      const res = await list(`segment=${type}&pageSize=100`);
      const expected = last30d.filter((o) => o.type === type);
      expect(numbers(res.body.items)).toEqual(numbers(expected));
      expect(res.body.total).toBe(expected.length);
      // The counts ignore the segment: every tab keeps its own total.
      expect(res.body.counts).toEqual(tabCounts(last30d));
    }
  });

  it('filters by hub code, case-insensitively', async () => {
    const torId = dataset.hubs.find((hub) => hub.code === 'TOR')!.id;
    const atToronto = last30d.filter((o) => o.hubId === torId);
    for (const hub of ['TOR', 'tor']) {
      const res = await list(`hub=${hub}&pageSize=100`);
      expect(numbers(res.body.items)).toEqual(numbers(atToronto));
      expect(res.body.counts).toEqual({
        ...tabCounts(atToronto),
        alerts: 0,
        drafts: 0,
        attention: 1,
      });
    }
    expect((await list('hub=XYZ')).body.total).toBe(0);
  });

  it('filters by status', async () => {
    const inProgress = await list('status=in_progress');
    expect(numbers(inProgress.body.items)).toEqual(['FR001676', 'FR001674', 'FR001383']);
    const closed = await list('status=closed&period=all&pageSize=100');
    expect(closed.body.total).toBe(dataset.orders.filter((o) => o.status === 'closed').length);
  });

  it.each(['today', 'week', 'all'] as const)(
    'filters by period=%s on the local order date',
    async (period) => {
      const expected = seededOrders(dataset, period);
      const res = await list(`period=${period}&pageSize=100`);
      expect(res.body.total).toBe(expected.length);
      expect(numbers(res.body.items)).toEqual(numbers(expected.slice(0, 100)));
    },
  );

  it('searches order numbers, refs, sub-orders and invoices', async () => {
    const search = async (q: string) =>
      numbers((await list(`period=all&q=${encodeURIComponent(q)}`)).body.items);

    expect(await search('fr001383')).toEqual(['FR001383']); // order number, any case
    expect(await search('ref-1012')).toEqual(['FR001383']); // cross-dock ref
    expect(await search('FR001674-2')).toEqual(['FR001674']); // sub-order number
    expect(await search('REF-1017')).toEqual(['FR001677']); // sub-order ref
    expect(await search('  FR001383  ')).toEqual(['FR001383']); // trimmed
    expect(await search('001812')).toEqual(['FR001672']); // invoice number…
    expect(await search('#001812')).toEqual(['FR001672']); // …as displayed
    expect(await search('#')).toEqual([]); // a bare '#' is not an invoice search
  });

  it('searches carrier names', async () => {
    const res = await list('period=all&pageSize=100&q=purolator');
    const carrierId = dataset.carriers.find((c) => c.name === 'Purolator Freight')!.id;
    expect(res.body.total).toBe(dataset.orders.filter((o) => o.carrierId === carrierId).length);
    expect(numbers(res.body.items)).toContain('FR001677');
    for (const item of res.body.items) expect(item.carrier.name).toBe('Purolator Freight');
  });

  it('matches LIKE wildcards in the search literally', async () => {
    // Unescaped, '_' and '%' would match every order and a trailing '\' would be a SQL error.
    for (const q of ['_', '%', 'REF_1012', 'FR00138%', '\\']) {
      const res = await list(`period=all&q=${encodeURIComponent(q)}`);
      expect(res.body.total).toBe(0);
    }
  });

  it('pages through the filtered orders', async () => {
    const first = await list('pageSize=5');
    expect(numbers(first.body.items)).toEqual(FEATURED_LIST_ORDER.slice(0, 5));
    const second = await list('pageSize=5&page=2');
    expect(numbers(second.body.items)).toEqual(FEATURED_LIST_ORDER.slice(5, 10));

    const { pageCount, total } = first.body;
    expect(pageCount).toBe(Math.ceil(total / 5));
    const last = await list(`pageSize=5&page=${pageCount}`);
    expect(last.body.items).toHaveLength(total - (pageCount - 1) * 5);
    const beyond = await list(`pageSize=5&page=${pageCount + 1}`);
    expect(beyond.body).toMatchObject({ items: [], total });

    expect((await list('page=100000')).body.items).toEqual([]);
    expect((await list('pageSize=100')).body.items).toHaveLength(Math.min(100, total));
  });

  it.each([
    ['an unknown param', 'foo=1', 'property foo should not exist'],
    ['an unknown segment', 'segment=nope', 'segment must be one of'],
    ['an unknown period', 'period=year', 'period must be one of'],
    ['an unknown status', 'status=lost', 'status must be one of'],
    ['a malformed hub', 'hub=m', 'hub must be a hub code such as MAR'],
    ['page 0', 'page=0', 'page must not be less than 1'],
    ['a page past 100000', 'page=100001', 'page must not be greater than 100000'],
    ['an overflowing page', 'page=1e20', 'page must not be greater than 100000'],
    ['a fractional page', 'page=1.5', 'page must be an integer number'],
    ['pageSize 0', 'pageSize=0', 'pageSize must not be less than 1'],
    ['pageSize 101', 'pageSize=101', 'pageSize must not be greater than 100'],
    ['a NUL in q', 'q=%00', 'q must not contain NUL characters'],
    ['a 65-character q', `q=${'a'.repeat(65)}`, 'q must be shorter than or equal to 64 characters'],
    ['a repeated q', 'q=a&q=b', 'q must be a string'],
  ])('rejects %s with 400', async (_name, query, message) => {
    const res = await get(app, `/api/orders?${query}`).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    expect(res.body.message.join('\n')).toContain(message);
  });
});
