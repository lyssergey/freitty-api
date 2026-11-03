import { describe, expect, it } from 'vitest';
import type { Hub } from '../hubs/hub.entity.js';
import type { User } from '../users/user.entity.js';
import type { CargoItem } from './entities/cargo-item.entity.js';
import type { Operation } from './entities/operation.entity.js';
import type { OrderAlert } from './entities/order-alert.entity.js';
import type { OrderSupply } from './entities/order-supply.entity.js';
import type { Order } from './entities/order.entity.js';
import type { SubOrder } from './entities/sub-order.entity.js';
import {
  cargoDeltas,
  isClientAction,
  summarizeCargo,
  toOrderDetail,
  toOrderListItem,
} from './order.mapper.js';

// Plain objects shaped like loaded entities: the mapper is pure, no database needed.

const hub = (code: string, dockCount = 24) =>
  ({
    id: `hub-${code}`,
    code,
    name: code,
    province: 'ON',
    timezone: 'America/Toronto',
    dockCount,
  }) as Hub;

const user = (n: number, role: User['role'] = 'dispatcher') =>
  ({
    id: `user-${n}`,
    companyId: 'company-1',
    company: null,
    name: `User ${n}`,
    initials: `U${n}`,
    email: `user${n}@example.test`,
    role,
    avatarColor: '#0EA5E9',
    createdAt: new Date(0),
  }) as User;

const cargo = (
  unitType: CargoItem['unitType'],
  declaredQty: number,
  actualQty: number | null,
  subOrderId: string | null = null,
) =>
  ({
    id: `cargo-${Math.random()}`,
    orderId: 'order-1',
    subOrderId,
    unitType,
    declaredQty,
    actualQty,
  }) as CargoItem;

const alert = (id: string, createdAt: string, extra: Partial<OrderAlert> = {}) =>
  ({
    id,
    orderId: 'order-1',
    subOrderId: null,
    kind: 'photo_missing',
    message: `alert ${id}`,
    createdAt: new Date(createdAt),
    resolvedAt: null,
    ...extra,
  }) as OrderAlert;

const operation = (id: string, extra: Partial<Operation>) =>
  ({
    id,
    orderId: 'order-1',
    kind: 'unloading',
    billable: true,
    trailerNumber: null,
    qty: 1,
    unitType: 'standard',
    rateCents: 1800,
    appliedAt: new Date('2026-04-17T12:00:00Z'),
    commentsCount: 0,
    photosCount: 0,
    ...extra,
  }) as Operation;

const supply = (
  id: string,
  sku: string,
  name: string,
  category: OrderSupply['supplyItem']['category'],
  qty: number,
  unitPriceCents: number,
) =>
  ({
    id,
    orderId: 'order-1',
    supplyItemId: `item-${sku}`,
    supplyItem: { id: `item-${sku}`, sku, name, category, unitPriceCents },
    qty,
    unitPriceCents,
  }) as OrderSupply;

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    number: 'FR001383',
    companyId: 'company-1',
    company: {
      id: 'company-1',
      name: 'R-way Transport',
      balanceCents: 125_000,
      createdAt: new Date(0),
    },
    type: 'cross_dock',
    status: 'in_progress',
    services: ['transload'],
    refNumber: 'REF-1012',
    hubId: 'hub-MAR',
    hub: hub('MAR'),
    destinationHubId: null,
    destinationHub: null,
    scheduledAt: new Date('2026-04-17T12:00:00Z'),
    destination: 'Montréal, QC',
    destinationNote: null,
    carrierMode: 'carrier',
    carrierId: 'carrier-1',
    carrier: { id: 'carrier-1', name: 'R-way Transport Inc.', phone: '+1 647 555 0199' },
    driverId: null,
    driver: null,
    createdById: 'user-2',
    createdBy: user(2),
    assigneeId: null,
    assignee: null,
    cargoStatus: 'on_stock',
    currentOperation: null,
    nextAction: null,
    nextActionAt: null,
    truckNumber: null,
    trailerNumber: null,
    trailerType: null,
    dockNumber: null,
    dockBay: null,
    dockAssignedAt: null,
    consolidatedTrailers: null,
    warehouseNote: null,
    photosCount: 0,
    messagesCount: 0,
    unreadMessagesCount: 0,
    closedAt: null,
    createdAt: new Date('2026-04-07T15:30:00Z'),
    updatedAt: new Date('2026-04-17T10:00:00Z'),
    subOrders: [],
    cargoItems: [],
    alerts: [],
    operations: [],
    supplies: [],
    invoice: null,
    ...overrides,
  } as Order;
}

describe('summarizeCargo', () => {
  it('aggregates lines per unit type, standard first', () => {
    const lines = [cargo('xl', 12, 12), cargo('standard', 9, 9), cargo('standard', 6, 6)];
    expect(summarizeCargo(lines)).toEqual([
      { unitType: 'standard', declared: 15, actual: 15 },
      { unitType: 'xl', declared: 12, actual: 12 },
    ]);
  });

  it('keeps actual null while no line of the type has been counted', () => {
    expect(summarizeCargo([cargo('standard', 23, null)])).toEqual([
      { unitType: 'standard', declared: 23, actual: null },
    ]);
  });

  it('sums only the counted lines when some are still uncounted', () => {
    expect(summarizeCargo([cargo('standard', 10, 11), cargo('standard', 5, null)])).toEqual([
      { unitType: 'standard', declared: 15, actual: 11 },
    ]);
  });

  it('returns nothing for an order without cargo', () => {
    expect(summarizeCargo([])).toEqual([]);
  });
});

describe('cargoDeltas', () => {
  it('reports counted unit types that differ from the BOL, with a signed diff', () => {
    expect(
      cargoDeltas([
        { unitType: 'standard', declared: 10, actual: 12 },
        { unitType: 'xl', declared: 4, actual: 4 },
      ]),
    ).toEqual([{ unitType: 'standard', declared: 10, actual: 12, diff: 2 }]);
    expect(cargoDeltas([{ unitType: 'standard', declared: 20, actual: 18 }])).toEqual([
      { unitType: 'standard', declared: 20, actual: 18, diff: -2 },
    ]);
  });

  it('ignores uncounted cargo', () => {
    expect(cargoDeltas([{ unitType: 'standard', declared: 23, actual: null }])).toEqual([]);
  });
});

describe('toOrderListItem', () => {
  it('flags client-owned next actions', () => {
    expect(isClientAction('upload_photo')).toBe(true);
    expect(isClientAction('book_delivery')).toBe(true);
    expect(isClientAction('loading')).toBe(false);

    const item = toOrderListItem(
      makeOrder({ nextAction: 'confirm_bol', nextActionAt: new Date('2026-04-17T22:00:00Z') }),
    );
    expect(item.nextAction).toEqual({
      kind: 'confirm_bol',
      dueAt: '2026-04-17T22:00:00.000Z',
      requiresClient: true,
    });
    expect(toOrderListItem(makeOrder({ nextAction: 'dispatch' })).nextAction?.requiresClient).toBe(
      false,
    );
    expect(toOrderListItem(makeOrder()).nextAction).toBeNull();
  });

  it('summarizes sub-orders by position with their first open alert', () => {
    const subOrders = [
      { id: 's2', orderId: 'order-1', number: 'FR001674-2', refNumber: 'REF-1006', position: 2 },
      { id: 's1', orderId: 'order-1', number: 'FR001674-1', refNumber: 'REF-1005', position: 1 },
    ] as SubOrder[];
    const item = toOrderListItem(
      makeOrder({
        type: 'consolidation',
        refNumber: null,
        subOrders,
        cargoItems: [
          cargo('standard', 12, 11, 's1'),
          cargo('standard', 8, 7, 's2'),
          cargo('xl', 9, null, 's2'),
        ],
        alerts: [
          alert('late', '2026-04-16T16:10:00Z', { subOrderId: 's2', kind: 'late_arrival' }),
          alert('first', '2026-04-16T12:10:00Z', { subOrderId: 's2' }),
          alert('done', '2026-04-15T12:00:00Z', {
            subOrderId: 's1',
            resolvedAt: new Date('2026-04-15T13:00:00Z'),
          }),
        ],
      }),
    );

    expect(item.subOrders.map((s) => s.number)).toEqual(['FR001674-1', 'FR001674-2']);
    expect(item.subOrders[0]).toMatchObject({
      unitType: 'standard',
      declaredQty: 12,
      actualQty: 11,
      alert: null,
    });
    // XL declares 9 > 8 standard; actual sums the counted lines only.
    expect(item.subOrders[1]).toMatchObject({
      unitType: 'xl',
      declaredQty: 17,
      actualQty: 7,
      alert: { kind: 'photo_missing', message: 'alert first' },
    });
    expect(item.cargo).toEqual([
      { unitType: 'standard', declared: 20, actual: 18 },
      { unitType: 'xl', declared: 9, actual: null },
    ]);
  });

  it('lists only open alerts, newest first, with their sub-order number', () => {
    const item = toOrderListItem(
      makeOrder({
        subOrders: [
          { id: 's1', orderId: 'order-1', number: 'FR1-1', refNumber: 'R', position: 1 },
        ] as SubOrder[],
        alerts: [
          alert('old', '2026-04-15T10:00:00Z'),
          alert('new', '2026-04-16T10:00:00Z', { subOrderId: 's1' }),
          alert('resolved', '2026-04-17T10:00:00Z', {
            resolvedAt: new Date('2026-04-17T11:00:00Z'),
          }),
        ],
      }),
    );
    expect(item.openAlerts.map((a) => [a.id, a.subOrderNumber])).toEqual([
      ['new', 'FR1-1'],
      ['old', null],
    ]);
  });

  it('describes the carrier for each mode', () => {
    expect(toOrderListItem(makeOrder()).carrier).toEqual({
      mode: 'carrier',
      name: 'R-way Transport Inc.',
      phone: '+1 647 555 0199',
      driver: null,
    });
    const byDriver = toOrderListItem(
      makeOrder({
        carrierMode: 'driver',
        carrierId: null,
        carrier: null,
        driverId: 'user-5',
        driver: user(5, 'driver'),
      }),
    );
    expect(byDriver.carrier).toMatchObject({
      mode: 'driver',
      name: null,
      driver: { name: 'User 5', initials: 'U5' },
    });
    expect(
      toOrderListItem(makeOrder({ carrierMode: null, carrierId: null, carrier: null })).carrier,
    ).toBeNull();
  });

  it('serializes dates and the invoice', () => {
    const item = toOrderListItem(
      makeOrder({
        status: 'closed',
        closedAt: new Date('2026-04-14T22:10:00Z'),
        invoice: {
          id: 'inv-1',
          number: '001812',
          orderId: 'order-1',
          order: undefined as never,
          amountCents: 46_400,
          issuedAt: new Date('2026-04-14T22:15:00Z'),
          paidAt: null,
        },
      }),
    );
    expect(item).toMatchObject({
      closedAt: '2026-04-14T22:10:00.000Z',
      createdAt: '2026-04-07T15:30:00.000Z',
      invoice: {
        number: '001812',
        amountCents: 46_400,
        issuedAt: '2026-04-14T22:15:00.000Z',
        paidAt: null,
      },
    });
  });
});

describe('toOrderDetail', () => {
  const order = makeOrder({
    cargoItems: [cargo('standard', 10, 12)],
    dockNumber: 12,
    dockBay: 'B',
    dockAssignedAt: new Date('2026-04-17T12:42:00Z'),
    assigneeId: 'user-6',
    assignee: user(6, 'floor_lead'),
    messagesCount: 4,
    unreadMessagesCount: 1,
    operations: [
      operation('loading', {
        kind: 'loading',
        qty: 11,
        appliedAt: new Date('2026-04-17T14:40:00Z'),
      }),
      operation('unloading', {
        qty: 12,
        appliedAt: new Date('2026-04-17T12:55:00Z'),
        trailerNumber: 'TRL-8830',
      }),
      operation('disposal', {
        kind: 'disposal',
        qty: 1,
        billable: false,
        rateCents: 0,
        appliedAt: new Date('2026-04-17T13:10:00Z'),
      }),
    ],
    supplies: [
      supply('wrap', 'WRP-SHR-120', 'Shrink wrap 120g', 'wrap', 2, 2400),
      supply('corners', 'EDG-CRN-50', 'Corners 50', 'edge_protection', 16, 125),
      supply('straps', 'SEC-STR-12', 'Straps 12', 'securement', 4, 650),
    ],
  });
  const detail = toOrderDetail(order);

  it('orders operations by time and bills only billable ones', () => {
    expect(detail.operations.map((op) => [op.kind, op.amountCents])).toEqual([
      ['unloading', 21_600],
      ['disposal', 0],
      ['loading', 19_800],
    ]);
  });

  it('lists an operation split per unit type standard first', () => {
    const at = new Date('2026-04-16T20:00:00Z');
    const split = toOrderDetail(
      makeOrder({
        operations: [
          operation('a', {
            kind: 'loading',
            qty: 12,
            unitType: 'xl',
            rateCents: 2200,
            appliedAt: at,
          }),
          operation('b', { kind: 'loading', qty: 15, appliedAt: at }),
        ],
      }),
    );
    expect(split.operations.map((op) => [op.unitType, op.qty, op.amountCents])).toEqual([
      ['standard', 15, 27_000],
      ['xl', 12, 26_400],
    ]);
  });

  it('groups supplies by category and computes line totals', () => {
    expect(detail.supplies.map((s) => [s.sku, s.lineTotalCents])).toEqual([
      ['SEC-STR-12', 2600],
      ['EDG-CRN-50', 2000],
      ['WRP-SHR-120', 4800],
    ]);
  });

  it('totals operations and supplies', () => {
    expect(detail.totals).toEqual({
      operationsCents: 41_400,
      suppliesCents: 9400,
      totalCents: 50_800,
    });
  });

  it('exposes deltas, dock, assignee and messages', () => {
    expect(detail.deltas).toEqual([{ unitType: 'standard', declared: 10, actual: 12, diff: 2 }]);
    expect(detail.dock).toEqual({
      number: 12,
      bay: 'B',
      assignedAt: '2026-04-17T12:42:00.000Z',
      hubDockCount: 24,
    });
    expect(detail.assignee?.name).toBe('User 6');
    expect(detail.messages).toEqual({ total: 4, unread: 1 });
    expect(detail.company).toEqual({ id: 'company-1', name: 'R-way Transport' });
  });

  it('handles an empty draft', () => {
    const draft = toOrderDetail(
      makeOrder({ status: 'draft', carrierMode: null, carrier: null, carrierId: null }),
    );
    expect(draft).toMatchObject({
      cargo: [],
      deltas: [],
      operations: [],
      supplies: [],
      dock: null,
      carrier: null,
      totals: { operationsCents: 0, suppliesCents: 0, totalCents: 0 },
    });
  });
});
