import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrderRow } from '../src/database/seeds/seed-types.js';
import { ORDER_STATUS_LIFECYCLE, type OrderStatus } from '../src/modules/orders/order.enums.js';
import { BOARD_COLUMN_LIMIT } from '../src/modules/orders/orders.service.js';
import { createE2eApp, get } from './e2e-app.js';
import { numbers, seededDataset, seededOrders } from './seeded.js';

interface Column {
  status: OrderStatus;
  count: number;
  items: Array<{ number: string; status: OrderStatus }>;
}

/** The board as columns of seeded orders: every status, its count, its newest 20. */
const expectedColumns = (orders: OrderRow[]) =>
  ORDER_STATUS_LIFECYCLE.map((status) => {
    const inColumn = orders.filter((o) => o.status === status);
    return {
      status,
      count: inColumn.length,
      numbers: numbers(inColumn.slice(0, BOARD_COLUMN_LIMIT)),
    };
  });

const columnsOf = (body: { columns: Column[] }) =>
  body.columns.map(({ status, count, items }) => ({ status, count, numbers: numbers(items) }));

describe('GET /api/orders/board (e2e)', () => {
  let app: INestApplication;
  const dataset = seededDataset();

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('shows all 7 statuses in lifecycle order with full counts', async () => {
    const res = await get(app, '/api/orders/board').expect(200);
    const columns = columnsOf(res.body);
    expect(columns).toEqual(expectedColumns(seededOrders(dataset, '30d')));
    expect(columns.slice(0, 6)).toEqual([
      { status: 'draft', count: 1, numbers: ['DRAFT-003'] },
      { status: 'ready', count: 2, numbers: ['FR001681', 'FR001679'] },
      { status: 'in_progress', count: 3, numbers: ['FR001676', 'FR001674', 'FR001383'] },
      { status: 'consolidated', count: 1, numbers: ['FR001680'] },
      { status: 'in_transit', count: 1, numbers: ['FR001677'] },
      { status: 'deconsolidated', count: 0, numbers: [] },
    ]);
    for (const column of res.body.columns as Column[]) {
      expect(column.items.every((item) => item.status === column.status)).toBe(true);
    }

    // The columns hold exactly the orders of the list under the same filters.
    const list = await get(app, '/api/orders').expect(200);
    expect(columns.reduce((sum, column) => sum + column.count, 0)).toBe(list.body.total);
  });

  it(`caps every column at ${BOARD_COLUMN_LIMIT} orders, counting all of them`, async () => {
    const res = await get(app, '/api/orders/board?period=all').expect(200);
    const closed = columnsOf(res.body).find((column) => column.status === 'closed')!;
    expect(closed.count).toBe(dataset.orders.filter((o) => o.status === 'closed').length);
    expect(closed.numbers).toHaveLength(BOARD_COLUMN_LIMIT);
    expect(columnsOf(res.body)).toEqual(expectedColumns(seededOrders(dataset, 'all')));
  });

  it('applies the hub and search filters of the list', async () => {
    const torId = dataset.hubs.find((hub) => hub.code === 'TOR')!.id;
    const toronto = await get(app, '/api/orders/board?hub=TOR').expect(200);
    expect(columnsOf(toronto.body)).toEqual(
      expectedColumns(seededOrders(dataset, '30d').filter((o) => o.hubId === torId)),
    );

    const invoice = await get(app, '/api/orders/board?period=all&q=%23001812').expect(200);
    expect(columnsOf(invoice.body).filter((column) => column.count > 0)).toEqual([
      { status: 'closed', count: 1, numbers: ['FR001672'] },
    ]);
  });

  it('takes no status and no paging', async () => {
    for (const query of ['status=ready', 'page=2', 'pageSize=5']) {
      await get(app, `/api/orders/board?${query}`).expect(400);
    }
  });
});
