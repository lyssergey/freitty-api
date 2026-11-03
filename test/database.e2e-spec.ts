import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDatabase } from '../src/database/seeds/seed-database.js';
import { tableName } from '../src/database/table-name.js';
import { Order } from '../src/modules/orders/entities/order.entity.js';
import { createE2eApp } from './e2e-app.js';
import { seededDataset, TIME_ZONE } from './seeded.js';

describe('migrations and seed (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createE2eApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps every table, TypeORM `migrations` included, in schema freitty', async () => {
    const tables = await dataSource.query<Array<{ schema: string; table: string }>>(
      `SELECT table_schema AS "schema", table_name AS "table" FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_name`,
    );
    expect(new Set(tables.map((row) => row.schema))).toEqual(new Set(['freitty']));
    expect(tables.map((row) => row.table)).toEqual(
      [...dataSource.entityMetadatas.map((metadata) => metadata.tableName), 'migrations'].sort(),
    );

    const applied = await dataSource.query<Array<{ name: string }>>(
      'SELECT name FROM "freitty"."migrations" ORDER BY id',
    );
    expect(applied.map((row) => row.name)).toEqual(dataSource.migrations.map((m) => m.name));
    // installExtensions: false — uuids come from core gen_random_uuid().
    const extensions = await dataSource.query<Array<{ extname: string }>>(
      'SELECT extname FROM pg_extension',
    );
    expect(extensions.map((row) => row.extname)).toEqual(['plpgsql']);
  });

  it('leaves no drift between the migrated schema and the entities', async () => {
    const sql = await dataSource.driver.createSchemaBuilder().log();
    expect(sql.upQueries.map((query) => query.query)).toEqual([]);
  });

  it('seeds every row of the dataset, and a re-seed restores the same rows', async () => {
    const dataset = seededDataset();
    const orderIds = () =>
      dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM ${tableName(dataSource, Order)} ORDER BY id`,
      );
    const before = await orderIds();
    expect(before).toHaveLength(dataset.orders.length);

    const summary = await seedDatabase(dataSource, new Date(), TIME_ZONE);
    expect(Object.fromEntries(summary.map(({ table, rows }) => [table, rows]))).toEqual({
      companies: dataset.companies.length,
      users: dataset.users.length,
      hubs: dataset.hubs.length,
      carriers: dataset.carriers.length,
      supply_items: dataset.supplyItems.length,
      orders: dataset.orders.length,
      sub_orders: dataset.subOrders.length,
      cargo_items: dataset.cargoItems.length,
      order_alerts: dataset.alerts.length,
      operations: dataset.operations.length,
      order_supplies: dataset.orderSupplies.length,
      invoices: dataset.invoices.length,
    });
    expect(await orderIds()).toEqual(before);
  });
});
