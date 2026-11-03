import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, get } from './e2e-app.js';

/** `minutes` before / after the pinned clock, as the API writes instants. */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const inMin = (minutes: number) => ago(-minutes);

interface Operation {
  kind: string;
  appliedAt: string;
}

describe('GET /api/orders/:number (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns FR001383 with its operations, supplies, totals, delta and dock', async () => {
    const res = await get(app, '/api/orders/FR001383').expect(200);
    expect(res.body).toMatchObject({
      number: 'FR001383',
      type: 'cross_dock',
      status: 'in_progress',
      services: ['transload', 'restock_rework'],
      refNumber: 'REF-1012',
      subOrders: [],
      hub: { code: 'MAR', name: 'Markham' },
      destinationHub: null,
      scheduledAt: ago(150),
      destination: 'Montréal, QC',
      cargo: [{ unitType: 'standard', declared: 10, actual: 12 }],
      deltas: [{ unitType: 'standard', declared: 10, actual: 12, diff: 2 }],
      carrier: { mode: 'carrier', name: 'R-way Transport Inc.', driver: null },
      createdBy: { name: 'User 2', role: 'dispatcher' },
      assignee: { name: 'User 6', role: 'floor_lead' },
      company: { name: 'R-way Transport' },
      cargoStatus: 'on_stock',
      currentOperation: 'loading',
      nextAction: { kind: 'dispatch', dueAt: inMin(90), requiresClient: false },
      truckNumber: 'TRK-4521',
      trailerNumber: 'TRL-8830',
      trailerType: 'van_53',
      dock: { number: 12, bay: 'B', assignedAt: ago(138), hubDockCount: 24 },
      warehouseNote:
        'Counted 12 pallets on arrival, BOL says 10. 1 pallet damaged → routed to Disposal.',
      photosCount: 5,
      messages: { total: 0, unread: 0 },
      openAlerts: [],
      invoice: null,
      closedAt: null,
    });

    // Oldest first; restack and disposal are not billed.
    expect(res.body.operations).toEqual([
      operation('unloading', 12, 'standard', 1800, ago(125), { trailer: 'TRL-8830', photos: 4 }),
      operation('disposal', 1, 'standard', 0, ago(110), { comments: 1, photos: 2 }),
      operation('restack', 11, 'standard', 0, ago(95), { photos: 1 }),
      operation('loading', 11, 'standard', 1800, ago(20), { trailer: 'TRL-8830' }),
    ]);
    // Grouped by category (securement → edge protection → wrap).
    expect(res.body.supplies).toEqual([
      supply('SEC-STR-12', 'Straps 12', 'securement', 4, 650),
      supply('EDG-CRN-50', 'Corners 50', 'edge_protection', 16, 125),
      supply('WRP-SHR-120', 'Shrink wrap 120g', 'wrap', 2, 2400),
    ]);
    expect(res.body.totals).toEqual({
      operationsCents: 41_400,
      suppliesCents: 9_400,
      totalCents: 50_800,
    });
  });

  it('books consolidation and loading per unit type, standard first', async () => {
    const perUnit = (ops: Operation[], kind: string) => ops.filter((op) => op.kind === kind);

    const fr76 = await get(app, '/api/orders/FR001676').expect(200);
    const consolidation = perUnit(fr76.body.operations, 'consolidation');
    expect(consolidation).toMatchObject([
      { qty: 15, unitType: 'standard', amountCents: 13_500 },
      { qty: 12, unitType: 'xl', amountCents: 10_800 },
    ]);
    expect(consolidation[0]!.appliedAt).toBe(consolidation[1]!.appliedAt);
    expect(fr76.body.totals).toEqual({
      operationsCents: 77_700,
      suppliesCents: 18_240,
      totalCents: 95_940,
    });

    const fr77 = await get(app, '/api/orders/FR001677').expect(200);
    expect(perUnit(fr77.body.operations, 'consolidation')).toMatchObject([
      { qty: 27, unitType: 'standard', amountCents: 24_300 },
      { qty: 6, unitType: 'xl', amountCents: 5_400 },
    ]);
    expect(perUnit(fr77.body.operations, 'loading')).toMatchObject([
      { qty: 27, unitType: 'standard', amountCents: 48_600 },
      { qty: 6, unitType: 'xl', amountCents: 13_200 },
    ]);
    expect(fr77.body.totals.totalCents).toBe(153_300);
  });

  it('reads order numbers case-insensitively', async () => {
    for (const raw of ['fr001383', '%20fr001383%20']) {
      const res = await get(app, `/api/orders/${raw}`).expect(200);
      expect(res.body.number).toBe('FR001383');
    }
    const draft = await get(app, '/api/orders/draft-003').expect(200);
    expect(draft.body).toMatchObject({
      number: 'DRAFT-003',
      status: 'draft',
      carrier: null,
      cargo: [],
      operations: [],
      supplies: [],
      dock: null,
      totals: { operationsCents: 0, suppliesCents: 0, totalCents: 0 },
    });
  });

  it('answers 404 for an unknown number, naming it', async () => {
    for (const [raw, number] of [
      ['NOPE123', 'NOPE123'],
      ['nope123', 'NOPE123'],
      ['FR009999', 'FR009999'],
    ]) {
      const res = await get(app, `/api/orders/${raw}`).expect(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: `Order ${number} not found`,
        error: 'Not Found',
      });
    }
  });

  it('answers a generic 404 for anything that cannot be an order number', async () => {
    for (const raw of ['%00', 'FR001383%00', 'FR%25', 'FR%20001383', 'A'.repeat(33)]) {
      const res = await get(app, `/api/orders/${raw}`).expect(404);
      expect(res.body.message).toBe('Order not found');
    }
  });
});

function operation(
  kind: string,
  qty: number,
  unitType: string,
  rateCents: number,
  appliedAt: string,
  extra: { trailer?: string; comments?: number; photos?: number },
) {
  return {
    id: expect.any(String),
    kind,
    billable: rateCents > 0,
    trailerNumber: extra.trailer ?? null,
    qty,
    unitType,
    rateCents,
    amountCents: qty * rateCents,
    appliedAt,
    commentsCount: extra.comments ?? 0,
    photosCount: extra.photos ?? 0,
  };
}

function supply(sku: string, name: string, category: string, qty: number, unitPriceCents: number) {
  return {
    id: expect.any(String),
    sku,
    name,
    category,
    qty,
    unitPriceCents,
    lineTotalCents: qty * unitPriceCents,
  };
}
