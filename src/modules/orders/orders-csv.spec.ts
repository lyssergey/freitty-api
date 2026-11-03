import { describe, expect, it } from 'vitest';
import type { OrderListItem } from './order.types.js';
import {
  formatAmount,
  formatQuantity,
  ORDERS_CSV_HEADER,
  orderCsvRow,
  ordersToCsv,
} from './orders-csv.js';

const TZ = 'America/Toronto';

const item = (overrides: Partial<OrderListItem> = {}): OrderListItem => ({
  id: 'o1',
  number: 'FR001676',
  type: 'consolidation',
  status: 'in_progress',
  services: [],
  refNumber: null,
  subOrders: [
    {
      id: 's1',
      number: 'FR001676-1',
      refNumber: 'REF-1001',
      unitType: 'standard',
      declaredQty: 9,
      actualQty: 9,
      alert: null,
    },
    {
      id: 's2',
      number: 'FR001676-2',
      refNumber: 'REF-1003',
      unitType: 'xl',
      declaredQty: 12,
      actualQty: 12,
      alert: null,
    },
  ],
  hub: { id: 'h1', code: 'MAR', name: 'Markham', province: 'ON' },
  destinationHub: { id: 'h2', code: 'TOR', name: 'Toronto', province: 'ON' },
  scheduledAt: '2026-04-12T13:00:00.000Z', // 09:00 EDT
  destination: 'Toronto, ON',
  destinationNote: null,
  cargo: [
    { unitType: 'standard', declared: 15, actual: 15 },
    { unitType: 'xl', declared: 12, actual: 12 },
  ],
  carrier: {
    mode: 'driver',
    name: null,
    phone: null,
    driver: { id: 'u5', name: 'User 5', initials: 'U5', role: 'driver', avatarColor: '#DC2626' },
  },
  createdBy: { id: 'u1', name: 'User 1', initials: 'U1', role: 'admin', avatarColor: '#5B21B6' },
  consolidatedTrailers: 2,
  nextAction: { kind: 'loading', dueAt: null, requiresClient: false },
  openAlerts: [],
  invoice: null,
  createdAt: '2026-04-09T14:00:00.000Z',
  updatedAt: '2026-04-17T13:55:00.000Z',
  closedAt: null,
  ...overrides,
});

describe('orders CSV', () => {
  it('formats quantities and amounts', () => {
    expect(formatQuantity(item().cargo)).toBe('15 × Std + 12 × XL');
    expect(formatQuantity([])).toBe('');
    expect(formatAmount(50_800)).toBe('508.00');
    expect(formatAmount(46_405)).toBe('464.05');
    expect(formatAmount(5)).toBe('0.05');
  });

  it('maps an order to one row in the header order', () => {
    expect(orderCsvRow(item(), TZ)).toEqual([
      'FR001676',
      'Consolidation',
      'In progress',
      'REF-1001, REF-1003',
      'Markham',
      'Toronto',
      '2026-04-12 09:00',
      'Toronto, ON',
      '15 × Std + 12 × XL',
      'Driver: User 5',
      'User 1',
      'Loading',
      null,
      null,
    ]);
    expect(ORDERS_CSV_HEADER).toHaveLength(14);
  });

  it('writes paid closed cross-docks with invoice and amount', () => {
    const closed = item({
      number: 'FR001672',
      type: 'cross_dock',
      status: 'closed',
      refNumber: 'REF-1007',
      subOrders: [],
      destinationHub: null,
      scheduledAt: '2026-01-14T22:30:00.000Z', // 17:30 EST
      destination: 'Brampton, ON',
      destinationNote: 'Order with photos',
      carrier: { mode: 'self_pickup', name: null, phone: null, driver: null },
      nextAction: null,
      invoice: {
        number: '001812',
        amountCents: 46_400,
        issuedAt: '2026-01-14T23:15:00.000Z',
        paidAt: null,
      },
    });
    const csv = ordersToCsv([closed], TZ);
    expect(csv.split('\r\n')[1]).toBe(
      'FR001672,Cross-Dock,Completed,REF-1007,Markham,,2026-01-14 17:30,"Brampton, ON · Order with photos",15 × Std + 12 × XL,Self pickup,User 1,,#001812,464.00',
    );
  });
});
