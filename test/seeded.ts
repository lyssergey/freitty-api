import { datePresetRange, type DatePreset } from '../src/common/time/periods.js';
import { buildDataset } from '../src/database/seeds/dataset.js';
import type { Dataset, OrderRow } from '../src/database/seeds/seed-types.js';

/** APP_TIMEZONE of the e2e run (see setup-e2e.ts). */
export const TIME_ZONE = 'America/Toronto';

/**
 * The rows setup-e2e.ts seeded: `buildDataset` is pure and the clock is pinned to
 * the seed instant, so rebuilding it gives exactly those rows. Values that move
 * with the seed instant (orders in a date window, history per bucket) are
 * computed from it; the mockup's numbers, which hold at any instant, stay literal.
 */
export function seededDataset(): Dataset {
  return buildDataset(new Date(), TIME_ZONE);
}

/** Seeded orders whose order date falls in `period`, newest activity first (list order). */
export function seededOrders(dataset: Dataset, period: DatePreset): OrderRow[] {
  const { from, to } = datePresetRange(period, new Date(), TIME_ZONE);
  return dataset.orders
    .filter((order) => {
      const date = order.scheduledAt ?? order.createdAt;
      return (!from || date >= from) && (!to || date < to);
    })
    .sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.number.localeCompare(a.number),
    );
}

export function numbers(orders: ReadonlyArray<{ number: string }>): string[] {
  return orders.map((order) => order.number);
}

/** The mockup's order list (updated_at DESC): every featured order, all in the 30-day window. */
export const FEATURED_LIST_ORDER = [
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
