import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { zonedDayAt } from '../src/common/time/zoned-time.js';
import { Company } from '../src/modules/companies/company.entity.js';
import { Invoice } from '../src/modules/orders/entities/invoice.entity.js';
import { OrderAlert } from '../src/modules/orders/entities/order-alert.entity.js';
import { Order } from '../src/modules/orders/entities/order.entity.js';
import { User } from '../src/modules/users/user.entity.js';
import { createE2eApp, get } from './e2e-app.js';
import { seededDataset, TIME_ZONE } from './seeded.js';

/** Every read the demo user can make about orders, with filters that would match the other client. */
const PATHS = [
  '/api/orders',
  '/api/orders?period=all&pageSize=100',
  '/api/orders?period=all&q=FR0090',
  '/api/orders?period=all&q=900001',
  '/api/orders/board?period=all',
  '/api/orders/export?period=all',
  '/api/orders/FR009001',
  '/api/dashboard/summary',
  '/api/dashboard/recent-orders?limit=12',
  '/api/dashboard/activity?period=day',
  '/api/dashboard/activity?period=month',
];

describe('company scoping (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function snapshot(): Promise<Array<{ path: string; status: number; body: unknown }>> {
    const responses = [];
    for (const path of PATHS) {
      const res = await get(app, path);
      responses.push({
        path,
        status: res.status,
        body: res.type === 'text/csv' ? res.text : res.body,
      });
    }
    return responses;
  }

  it("never shows another client's orders, alerts or invoices", async () => {
    const before = await snapshot();
    await insertOtherClient(app.get(DataSource));
    expect(await snapshot()).toEqual(before);
  });
});

/**
 * A second client at the same hub whose orders would change every endpoint if a
 * query lost its company filter: the newest active order (created this week, an
 * open alert, a client-owned next action) and one closed yesterday with a paid
 * invoice.
 */
async function insertOtherClient(dataSource: DataSource): Promise<void> {
  const now = new Date();
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const closedAt = zonedDayAt(now, TIME_ZONE, -1, '12:00');
  const hubId = seededDataset().hubs[0]!.id;
  const companyId = randomUUID();
  const userId = randomUUID();
  const [activeId, closedId] = [randomUUID(), randomUUID()];
  const order = { companyId, type: 'cross_dock', hubId, createdById: userId } as const;

  await dataSource.transaction(async (manager) => {
    await manager.insert(Company, { id: companyId, name: 'Other Client', balanceCents: 0 });
    await manager.insert(User, {
      id: userId,
      companyId,
      name: 'Other User',
      initials: 'OU',
      email: 'user@other-client.example',
      role: 'admin',
      avatarColor: '#000000',
    });
    await manager.insert(Order, [
      {
        ...order,
        id: activeId,
        number: 'FR009001',
        status: 'in_progress',
        scheduledAt: now,
        nextAction: 'confirm_bol',
        nextActionAt: now,
        createdAt: minutesAgo(60),
        updatedAt: minutesAgo(1),
      },
      {
        ...order,
        id: closedId,
        number: 'FR009002',
        status: 'closed',
        scheduledAt: closedAt,
        closedAt,
        createdAt: minutesAgo(3 * 24 * 60),
        updatedAt: minutesAgo(2),
      },
    ]);
    await manager.insert(OrderAlert, {
      orderId: activeId,
      kind: 'photo_missing',
      message: 'Photo is missing.',
      createdAt: minutesAgo(1),
    });
    await manager.insert(Invoice, {
      number: '900001',
      orderId: closedId,
      amountCents: 99_999,
      issuedAt: closedAt,
      paidAt: closedAt,
    });
  });
}
