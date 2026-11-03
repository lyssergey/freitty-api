import { describe, expect, it } from 'vitest';
import { ACTIVITY_BUCKETS, completedWindows, DAY_MS } from '../../common/time/periods.js';
import { formatZonedDate, startOfZonedDay } from '../../common/time/zoned-time.js';
import { summarizeActivity } from '../../modules/dashboard/activity.js';
import type { ActivityRow } from '../../modules/dashboard/activity.sql.js';
import {
  ACTIVE_ORDER_STATUSES,
  CLIENT_NEXT_ACTIONS,
  OperationKind,
  OrderStatus,
  OrderType,
  type NextActionKind,
} from '../../modules/orders/order.enums.js';
import { buildDataset } from './dataset.js';
import type { Dataset, OrderRow } from './seed-types.js';

const TZ = 'America/Toronto';

// Different times of day and both DST transitions, so the relative-date logic
// holds whenever the seed runs.
const NOWS = [
  new Date('2026-04-17T14:00:00Z'), // mockup "today", 10:00 EDT
  new Date('2026-11-03T13:00:00Z'), // 08:00 EST
  new Date('2026-07-01T03:55:00Z'), // 23:55 EDT
  new Date('2026-03-08T05:30:00Z'), // 00:30 EST, DST starts that night
  new Date('2026-11-01T06:30:00Z'), // 01:30 EST, right after DST ended
];

const FEATURED = [
  'FR001676',
  'FR001681',
  'FR001674',
  'FR001672',
  'FR001668',
  'DRAFT-003',
  'FR001383',
  'FR001679',
  'FR001680',
  'FR001677',
];

const ACTIVE = new Set<string>(ACTIVE_ORDER_STATUSES);
const CLIENT_ACTIONS = new Set<NextActionKind>(CLIENT_NEXT_ACTIONS);

function stats(dataset: Dataset, now: Date) {
  const openAlertOrders = new Set(
    dataset.alerts.filter((a) => a.resolvedAt === null).map((a) => a.orderId),
  );
  const active = dataset.orders.filter((o) => ACTIVE.has(o.status));
  const numbers = (orders: OrderRow[]) => orders.map((o) => o.number).sort();
  const windows = completedWindows(now);
  const closedWithin = ({ after, until }: { after: Date; until: Date }) =>
    dataset.orders.filter(
      (o) => o.status === OrderStatus.CLOSED && o.closedAt! > after && o.closedAt! <= until,
    ).length;

  return {
    active: numbers(active),
    activeCreatedThisWeek: numbers(
      active.filter((o) => o.createdAt.getTime() >= now.getTime() - 7 * DAY_MS),
    ),
    drafts: numbers(dataset.orders.filter((o) => o.status === OrderStatus.DRAFT)),
    alertOrders: numbers(active.filter((o) => openAlertOrders.has(o.id))),
    awaitingAction: numbers(
      active.filter(
        (o) => o.nextAction && CLIENT_ACTIONS.has(o.nextAction) && !openAlertOrders.has(o.id),
      ),
    ),
    closedLast30d: closedWithin(windows.last30d),
    closedPrevious30d: closedWithin(windows.previous30d),
  };
}

/** Completed orders per local day, oldest first: the dashboard's Day chart (see activity.sql.ts). */
function dayActivity(dataset: Dataset, now: Date): ActivityRow[] {
  const closedOn = new Map<string, number>();
  for (const o of dataset.orders.filter((o) => o.status === OrderStatus.CLOSED)) {
    const day = formatZonedDate(o.closedAt!, TZ);
    closedOn.set(day, (closedOn.get(day) ?? 0) + 1);
  }
  const { count } = ACTIVITY_BUCKETS.day;
  return Array.from({ length: count }, (_, i) => {
    const start = formatZonedDate(startOfZonedDay(now, TZ, i - count + 1), TZ);
    return { start, completed: closedOn.get(start) ?? 0, spendCents: 0, paidInvoices: 0 };
  });
}

/** Quantity per unit type, e.g. `{ standard: 27, xl: 6 }`. */
function qtyPerUnit(rows: Array<{ unitType: string; qty: number }>): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const { unitType, qty } of rows) sums[unitType] = (sums[unitType] ?? 0) + qty;
  return sums;
}

describe.each(NOWS)('buildDataset(%s)', (now) => {
  const dataset = buildDataset(now, TZ);
  const byNumber = new Map(dataset.orders.map((o) => [o.number, o]));

  it('hits the dashboard targets', () => {
    expect(stats(dataset, now)).toEqual({
      active: ['FR001383', 'FR001674', 'FR001676', 'FR001677', 'FR001679', 'FR001680', 'FR001681'],
      activeCreatedThisWeek: ['FR001679', 'FR001681'],
      drafts: ['DRAFT-003'],
      alertOrders: ['FR001674'],
      awaitingAction: ['FR001677', 'FR001679'],
      closedLast30d: 24,
      closedPrevious30d: 24,
    });
  });

  it('keeps the KPI windows a day after seeding', () => {
    const later = new Date(now.getTime() + 20 * 3_600_000);
    const { closedLast30d, closedPrevious30d } = stats(dataset, later);
    expect([closedLast30d, closedPrevious30d]).toEqual([24, 24]);
  });

  it('closes 2 orders yesterday and at least 1 the day before (Day comparison > 0)', () => {
    const rows = dayActivity(dataset, now);
    const [dayBefore, yesterday] = rows.slice(-3, -1).map((row) => row.completed);
    expect(yesterday).toBe(2);
    expect(dayBefore).toBeGreaterThanOrEqual(1);
    expect(summarizeActivity(rows).comparison.completedChangePct).toBeGreaterThan(0);
  });

  it('orders the list and recent orders like the mockups', () => {
    const byUpdated = [...dataset.orders].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.number.localeCompare(a.number),
    );
    expect(byUpdated.slice(0, 6).map((o) => o.number)).toEqual([
      'FR001676',
      'FR001681',
      'FR001674',
      'FR001672',
      'FR001668',
      'DRAFT-003',
    ]);
    expect(
      byUpdated
        .filter((o) => o.status !== OrderStatus.DRAFT)
        .slice(0, 4)
        .map((o) => o.number),
    ).toEqual(['FR001676', 'FR001681', 'FR001674', 'FR001672']);
  });

  it('generates ~380 closed historical orders numbered up to FR001667', () => {
    const history = dataset.orders.filter((o) => !FEATURED.includes(o.number));
    expect(history.every((o) => o.number >= 'FR001200' && o.number <= 'FR001667')).toBe(true);
    expect(history.length).toBeGreaterThan(340);
    expect(history.length).toBeLessThan(420);
    expect(history.every((o) => o.status === OrderStatus.CLOSED)).toBe(true);
    expect(history.map((o) => o.number)).toContain('FR001667');
    const newestCreated = history.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    expect(newestCreated.number).toBe('FR001667');
    // Every historical order is older than every featured one (list ordering).
    const oldestFeatured = Math.min(
      ...dataset.orders.filter((o) => !history.includes(o)).map((o) => o.updatedAt.getTime()),
    );
    expect(history.every((o) => o.updatedAt.getTime() < oldestFeatured)).toBe(true);
    expect(history.every((o) => o.updatedAt.getTime() === o.closedAt!.getTime())).toBe(true);
  });

  it('numbers invoices sequentially by issue time, FR001672 = 001812', () => {
    const invoice = dataset.invoices.find((i) => i.orderId === byNumber.get('FR001672')!.id);
    expect(invoice?.number).toBe('001812');
    expect(invoice?.amountCents).toBe(46_400); // 2 × 10 XL × $22 + 1 × $24 shrink wrap
    const sorted = [...dataset.invoices].sort(
      (a, b) => a.issuedAt.getTime() - b.issuedAt.getTime(),
    );
    sorted.forEach((inv, i) => {
      if (i > 0) expect(Number(inv.number)).toBe(Number(sorted[i - 1]!.number) + 1);
    });
    expect(
      dataset.invoices.find((i) => i.orderId === byNumber.get('FR001668')!.id),
    ).toBeUndefined();
    expect(dataset.invoices.every((i) => i.paidAt === null || i.paidAt <= now)).toBe(true);
  });

  it('has unique numbers and resolvable foreign keys', () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(dataset.orders.map((o) => o.number))).toBe(true);
    expect(unique(dataset.subOrders.map((s) => s.number))).toBe(true);
    expect(unique(dataset.invoices.map((i) => i.number))).toBe(true);
    expect(unique(dataset.invoices.map((i) => i.orderId))).toBe(true);

    const allIds = Object.values(dataset).flatMap((rows: Array<{ id: string }>) =>
      rows.map((r) => r.id),
    );
    expect(unique(allIds)).toBe(true);

    const ids = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id));
    const [companies, users, hubs, carriers, supplies, orders, subOrders] = [
      ids(dataset.companies),
      ids(dataset.users),
      ids(dataset.hubs),
      ids(dataset.carriers),
      ids(dataset.supplyItems),
      ids(dataset.orders),
      ids(dataset.subOrders),
    ];
    const resolves = (set: Set<string>, id: string | null) => id === null || set.has(id);

    expect(dataset.users.every((u) => resolves(companies, u.companyId))).toBe(true);
    for (const o of dataset.orders) {
      expect(companies.has(o.companyId)).toBe(true);
      expect(hubs.has(o.hubId)).toBe(true);
      expect(resolves(hubs, o.destinationHubId)).toBe(true);
      expect(resolves(carriers, o.carrierId)).toBe(true);
      expect(resolves(users, o.driverId)).toBe(true);
      expect(users.has(o.createdById)).toBe(true);
      expect(resolves(users, o.assigneeId)).toBe(true);
    }
    expect(dataset.subOrders.every((s) => orders.has(s.orderId))).toBe(true);
    expect(
      dataset.cargoItems.every((c) => orders.has(c.orderId) && resolves(subOrders, c.subOrderId)),
    ).toBe(true);
    expect(
      dataset.alerts.every((a) => orders.has(a.orderId) && resolves(subOrders, a.subOrderId)),
    ).toBe(true);
    expect(dataset.operations.every((op) => orders.has(op.orderId))).toBe(true);
    expect(
      dataset.orderSupplies.every((s) => orders.has(s.orderId) && supplies.has(s.supplyItemId)),
    ).toBe(true);
    expect(dataset.invoices.every((i) => orders.has(i.orderId))).toBe(true);
  });

  it('builds the mockup detail order FR001383', () => {
    const order = byNumber.get('FR001383')!;
    const ops = dataset.operations.filter((op) => op.orderId === order.id);
    expect(ops.map((op) => [op.kind, op.qty, op.billable])).toEqual([
      ['unloading', 12, true],
      ['disposal', 1, false],
      ['restack', 11, false],
      ['loading', 11, true],
    ]);
    const cargo = dataset.cargoItems.filter((c) => c.orderId === order.id);
    expect(cargo.map((c) => [c.unitType, c.declaredQty, c.actualQty])).toEqual([
      ['standard', 10, 12],
    ]);
    expect(dataset.orderSupplies.filter((s) => s.orderId === order.id)).toHaveLength(3);
  });

  it('books consolidation and loading per unit type, as counted', () => {
    for (const order of dataset.orders.filter((o) => o.type === OrderType.CONSOLIDATION)) {
      const counted = qtyPerUnit(
        dataset.cargoItems
          .filter((c) => c.orderId === order.id)
          .map((c) => ({ unitType: c.unitType, qty: c.actualQty ?? c.declaredQty })),
      );
      for (const kind of [OperationKind.CONSOLIDATION, OperationKind.LOADING]) {
        const ops = dataset.operations.filter((op) => op.orderId === order.id && op.kind === kind);
        if (ops.length > 0) expect(qtyPerUnit(ops), `${order.number} ${kind}`).toEqual(counted);
      }
    }
    // FR001677 loads 27 Std + 6 XL, the XL pallets at the XL rate.
    const ops = dataset.operations.filter((op) => op.orderId === byNumber.get('FR001677')!.id);
    expect(ops.reduce((sum, op) => sum + (op.billable ? op.qty * op.rateCents : 0), 0)).toBe(
      153_300,
    );
  });

  it('never books more of a unit type than was counted (mixed cross-docks too)', () => {
    for (const order of dataset.orders) {
      const counted = qtyPerUnit(
        dataset.cargoItems
          .filter((c) => c.orderId === order.id)
          .map((c) => ({ unitType: c.unitType, qty: c.actualQty ?? c.declaredQty })),
      );
      const ops = dataset.operations.filter((op) => op.orderId === order.id);
      for (const kind of new Set(ops.map((op) => op.kind))) {
        if (kind === OperationKind.DISPOSAL) continue;
        const booked = qtyPerUnit(ops.filter((op) => op.kind === kind));
        for (const [unitType, qty] of Object.entries(booked)) {
          expect(qty, `${order.number} ${kind} ${unitType}`).toBeLessThanOrEqual(
            counted[unitType] ?? 0,
          );
        }
        // Transload and wrapping handle the whole cargo.
        if (kind === OperationKind.TRANSLOAD || kind === OperationKind.WRAPPING) {
          expect(booked, `${order.number} ${kind}`).toEqual(counted);
        }
      }
    }
  });
});

describe('buildDataset determinism', () => {
  it('returns deep-equal datasets for the same now', () => {
    const now = new Date('2026-04-17T14:00:00Z');
    expect(buildDataset(now, TZ)).toEqual(buildDataset(new Date(now), TZ));
  });

  it('keeps ids stable across seed days', () => {
    const a = buildDataset(new Date('2026-04-17T14:00:00Z'), TZ);
    const b = buildDataset(new Date('2026-04-18T14:00:00Z'), TZ);
    expect(b.users.map((u) => u.id)).toEqual(a.users.map((u) => u.id));
    expect(b.orders.slice(0, 10).map((o) => o.id)).toEqual(a.orders.slice(0, 10).map((o) => o.id));
  });
});
