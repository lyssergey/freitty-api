import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACTIVITY_BUCKETS, type ActivityPeriod } from '../src/common/time/periods.js';
import {
  addCalendarDays,
  formatZonedDate,
  startOfZonedIsoWeek,
  toZonedParts,
} from '../src/common/time/zoned-time.js';
import type { Dataset } from '../src/database/seeds/seed-types.js';
import { summarizeActivity } from '../src/modules/dashboard/activity.js';
import type { ActivityRow } from '../src/modules/dashboard/activity.sql.js';
import { createE2eApp, get } from './e2e-app.js';
import { FEATURED_LIST_ORDER, numbers, seededDataset, TIME_ZONE } from './seeded.js';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local start (`YYYY-MM-DD`) of the bucket containing `instant`. */
function bucketOf(instant: Date, period: ActivityPeriod): string {
  const { year, month } = toZonedParts(instant, TIME_ZONE);
  switch (period) {
    case 'day':
      return formatZonedDate(instant, TIME_ZONE);
    case 'week':
      return formatZonedDate(startOfZonedIsoWeek(instant, TIME_ZONE), TIME_ZONE);
    case 'month':
      return `${year}-${pad(month)}-01`;
    case 'quarter':
      return `${year}-${pad(month - ((month - 1) % 3))}-01`;
  }
}

/** The bucket `steps` buckets after the one starting on `start` (calendar arithmetic). */
function shiftBucket(start: string, period: ActivityPeriod, steps: number): string {
  const [year, month, day] = start.split('-').map(Number) as [number, number, number];
  if (period === 'day' || period === 'week') {
    const date = addCalendarDays({ year, month, day }, steps * (period === 'week' ? 7 : 1));
    return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
  }
  const shifted = new Date(Date.UTC(year, month - 1 + steps * (period === 'quarter' ? 3 : 1)));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-01`;
}

/** The activity rows computed from the seeded dataset instead of SQL. */
function expectedActivity(dataset: Dataset, period: ActivityPeriod): ActivityRow[] {
  const { count } = ACTIVITY_BUCKETS[period];
  const current = bucketOf(new Date(), period);
  return Array.from({ length: count }, (_, i) => {
    const start = shiftBucket(current, period, i - count + 1);
    const closed = dataset.orders.filter(
      (o) => o.status === 'closed' && bucketOf(o.closedAt!, period) === start,
    );
    const paid = dataset.invoices.filter(
      (invoice) => invoice.paidAt && bucketOf(invoice.paidAt, period) === start,
    );
    return {
      start,
      completed: closed.length,
      spendCents: paid.reduce((sum, invoice) => sum + invoice.amountCents, 0),
      paidInvoices: paid.length,
    };
  });
}

describe('dashboard (e2e)', () => {
  let app: INestApplication;
  const dataset = seededDataset();

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('summarizes the KPIs of the mockup', async () => {
    const res = await get(app, '/api/dashboard/summary').expect(200);
    expect(res.body).toEqual({
      activeOrders: { count: 7, createdThisWeek: 2 },
      completed: { last30d: 24, previous30d: 24 },
      needAttention: {
        total: 3,
        awaitingAction: 2,
        alertOrders: 1,
        alerts: [{ orderNumber: 'FR001674', kind: 'photo_missing', subOrderNumber: 'FR001674-2' }],
      },
    });
  });

  it('lists the newest non-draft orders as full cards', async () => {
    const recent = await get(app, '/api/dashboard/recent-orders').expect(200);
    expect(numbers(recent.body.items)).toEqual(['FR001676', 'FR001681', 'FR001674', 'FR001672']);
    expect(recent.body.items[3].invoice).toMatchObject({ number: '001812', amountCents: 46_400 });

    const twelve = await get(app, '/api/dashboard/recent-orders?limit=12').expect(200);
    const nonDraftFeatured = FEATURED_LIST_ORDER.filter((n) => !n.startsWith('DRAFT'));
    expect(numbers(twelve.body.items).slice(0, 9)).toEqual(nonDraftFeatured);
    // Then the newest closed historical orders.
    expect(twelve.body.items.slice(9)).toEqual(
      Array(3).fill(expect.objectContaining({ status: 'closed' })),
    );

    for (const limit of ['0', '13', 'four']) {
      await get(app, `/api/dashboard/recent-orders?limit=${limit}`).expect(400);
    }
  });

  it.each(['day', 'week', 'month', 'quarter'] as const)(
    'buckets activity per local %s, matching the seeded history',
    async (period) => {
      const res = await get(app, `/api/dashboard/activity?period=${period}`).expect(200);
      const rows = expectedActivity(dataset, period);
      expect(res.body.buckets).toHaveLength(ACTIVITY_BUCKETS[period].count); // 14 / 12 / 12 / 6
      // Compared as JSON, i.e. as sent: a rounded -0 % change goes over the wire as 0.
      const expected = { period, timezone: TIME_ZONE, ...summarizeActivity(rows) };
      expect(res.body).toEqual(JSON.parse(JSON.stringify(expected)));
    },
  );

  it('compares 2 orders completed yesterday with 1 the day before (+100%)', async () => {
    const res = await get(app, '/api/dashboard/activity?period=day').expect(200);
    const [dayBefore, yesterday, today] = res.body.buckets.slice(-3);
    expect(today.start).toBe(formatZonedDate(new Date(), TIME_ZONE));
    expect([dayBefore.completed, yesterday.completed]).toEqual([1, 2]);
    expect(res.body.comparison.completedChangePct).toBe(100);
  });

  it('defaults to months and rejects an unknown period', async () => {
    const res = await get(app, '/api/dashboard/activity').expect(200);
    expect(res.body.period).toBe('month');
    await get(app, '/api/dashboard/activity?period=year').expect(400);
  });
});
