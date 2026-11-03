import 'reflect-metadata';
import 'dotenv/config';
import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { configuration } from '../../config/configuration.js';
import { Carrier } from '../../modules/carriers/carrier.entity.js';
import { Company } from '../../modules/companies/company.entity.js';
import { Hub } from '../../modules/hubs/hub.entity.js';
import { CargoItem } from '../../modules/orders/entities/cargo-item.entity.js';
import { Invoice } from '../../modules/orders/entities/invoice.entity.js';
import { Operation } from '../../modules/orders/entities/operation.entity.js';
import { OrderAlert } from '../../modules/orders/entities/order-alert.entity.js';
import { OrderSupply } from '../../modules/orders/entities/order-supply.entity.js';
import { Order } from '../../modules/orders/entities/order.entity.js';
import { SubOrder } from '../../modules/orders/entities/sub-order.entity.js';
import { SupplyItem } from '../../modules/supplies/supply-item.entity.js';
import { User } from '../../modules/users/user.entity.js';
import { resolveAppSchema } from '../app-schema.js';
import dataSource from '../data-source.js';
import { buildDataset } from './dataset.js';
import type { Dataset } from './seed-types.js';

const CHUNK_SIZE = 500;

/**
 * `npm run db:seed` — replaces all app data with the demo dataset, in one
 * transaction: TRUNCATE every app table (schema-qualified) and bulk-insert in
 * foreign-key order. Idempotent (deterministic data, stable ids). Refuses to run
 * unless DB_SCHEMA is explicitly set to a dedicated schema: the database is shared.
 */
async function run(): Promise<void> {
  if (!process.env.DB_SCHEMA?.trim()) {
    throw new Error('Refusing to seed: set DB_SCHEMA to the app schema (e.g. DB_SCHEMA=freitty)');
  }
  const schema = resolveAppSchema(process.env.DB_SCHEMA); // throws for public / system schemas
  const { timezone } = configuration().app;
  const dataset = buildDataset(new Date(), timezone);

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      await truncateAppTables(manager, schema);
      for (const [entity, rows] of insertPlan(dataset)) await insertInChunks(manager, entity, rows);
      await assertTimestampsPersisted(manager, dataset);
    });
    console.log(`[seed] schema "${schema}" seeded (${timezone}):`);
    for (const [entity, rows] of insertPlan(dataset)) {
      console.log(`  ${dataSource.getMetadata(entity).tableName.padEnd(16)} ${rows.length}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

/** Parents before children. */
function insertPlan(d: Dataset): Array<[EntityTarget<ObjectLiteral>, ObjectLiteral[]]> {
  return [
    [Company, d.companies],
    [User, d.users],
    [Hub, d.hubs],
    [Carrier, d.carriers],
    [SupplyItem, d.supplyItems],
    [Order, d.orders],
    [SubOrder, d.subOrders],
    [CargoItem, d.cargoItems],
    [OrderAlert, d.alerts],
    [Operation, d.operations],
    [OrderSupply, d.orderSupplies],
    [Invoice, d.invoices],
  ];
}

/** Empties every entity table — all of them inside the app schema (checked), never `migrations`. */
async function truncateAppTables(manager: EntityManager, schema: string): Promise<void> {
  const tables = dataSource.entityMetadatas.map((metadata) => {
    if (metadata.schema !== schema) {
      throw new Error(`Refusing to truncate ${metadata.tablePath}: outside schema "${schema}"`);
    }
    return `"${schema}"."${metadata.tableName}"`;
  });
  await manager.query(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`);
}

async function insertInChunks(
  manager: EntityManager,
  entity: EntityTarget<ObjectLiteral>,
  rows: ObjectLiteral[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(entity)
      .values(rows.slice(i, i + CHUNK_SIZE))
      .updateEntity(false) // skip RETURNING: ids and timestamps are already in the rows
      .execute();
  }
}

/**
 * The list order and the KPIs depend on the seeded created_at / updated_at
 * values, so make sure Create/UpdateDateColumn defaults did not replace them.
 */
async function assertTimestampsPersisted(manager: EntityManager, dataset: Dataset): Promise<void> {
  const stored = await manager
    .getRepository(Order)
    .find({ select: { id: true, createdAt: true, updatedAt: true } });
  const expected = new Map(dataset.orders.map((o) => [o.id, o]));
  const mismatched = stored.filter((row) => {
    const seeded = expected.get(row.id);
    return (
      !seeded ||
      seeded.createdAt.getTime() !== row.createdAt.getTime() ||
      seeded.updatedAt.getTime() !== row.updatedAt.getTime()
    );
  });
  if (mismatched.length > 0 || stored.length !== dataset.orders.length) {
    throw new Error(
      `Seeded order timestamps were not persisted as given (${mismatched.length} rows)`,
    );
  }
}

run().catch((err: unknown) => {
  console.error('[seed] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
