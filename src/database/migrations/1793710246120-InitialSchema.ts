import type { MigrationInterface, QueryRunner } from 'typeorm';
import { resolveAppSchema } from '../app-schema.js';

/**
 * Initial schema. Generated with `npm run migration:generate` from the entities,
 * then reviewed by hand:
 * - enum types shared by several columns (`operation_kind`, `unit_type`) are
 *   created once (the generator emits one CREATE TYPE per table that uses them);
 * - statements are grouped: enum types → tables → indexes → foreign keys;
 * - the schema is not hard-coded: it is the DataSource's `schema` (DB_SCHEMA,
 *   validated — never `public`), so every statement stays inside the app schema.
 */
export class InitialSchema1793710246120 implements MigrationInterface {
  name = 'InitialSchema1793710246120';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const s = appSchema(queryRunner);

    // Enum types
    await queryRunner.query(
      `CREATE TYPE "${s}"."user_role" AS ENUM('admin', 'dispatcher', 'driver', 'floor_lead')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."supply_category" AS ENUM('securement', 'edge_protection', 'wrap', 'pallets', 'labeling')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."order_type" AS ENUM('cross_dock', 'consolidation')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."order_status" AS ENUM('draft', 'ready', 'in_progress', 'consolidated', 'in_transit', 'deconsolidated', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."service_kind" AS ENUM('storage', 'pickup', 'transload', 'restock_rework', 'labeling', 'shrink_wrap')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."carrier_mode" AS ENUM('carrier', 'driver', 'self_pickup')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."cargo_status" AS ENUM('expected', 'on_stock', 'dispatched')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."operation_kind" AS ENUM('unloading', 'loading', 'restack', 'disposal', 'transload', 'consolidation', 'deconsolidation', 'wrapping')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."next_action_kind" AS ENUM('await_truck', 'unloading', 'loading', 'consolidation', 'dispatch', 'deconsolidation', 'delivery', 'upload_photo', 'confirm_bol', 'book_delivery', 'approve_delta', 'pay_invoice')`,
    );
    await queryRunner.query(
      `CREATE TYPE "${s}"."trailer_type" AS ENUM('van_53', 'reefer_53', 'flatbed_48', 'straight_26')`,
    );
    await queryRunner.query(`CREATE TYPE "${s}"."unit_type" AS ENUM('standard', 'xl')`);
    await queryRunner.query(
      `CREATE TYPE "${s}"."alert_kind" AS ENUM('photo_missing', 'qty_mismatch', 'damaged_cargo', 'late_arrival')`,
    );

    // Reference data
    await queryRunner.query(
      `CREATE TABLE "${s}"."companies" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "balance_cents" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_companies" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "company_id" uuid, "name" character varying(80) NOT NULL, "initials" character varying(4) NOT NULL, "email" character varying(160) NOT NULL, "role" "${s}"."user_role" NOT NULL, "avatar_color" character varying(7) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_users_email" UNIQUE ("email"), CONSTRAINT "pk_users" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."hubs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "code" character varying(8) NOT NULL, "name" character varying(80) NOT NULL, "province" character varying(2) NOT NULL, "timezone" character varying(64) NOT NULL DEFAULT 'America/Toronto', "dock_count" smallint NOT NULL, CONSTRAINT "uq_hubs_code" UNIQUE ("code"), CONSTRAINT "pk_hubs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."carriers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "phone" character varying(32), CONSTRAINT "uq_carriers_name" UNIQUE ("name"), CONSTRAINT "pk_carriers" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."supply_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "sku" character varying(40) NOT NULL, "name" character varying(80) NOT NULL, "category" "${s}"."supply_category" NOT NULL, "unit_price_cents" integer NOT NULL, CONSTRAINT "uq_supply_items_sku" UNIQUE ("sku"), CONSTRAINT "pk_supply_items" PRIMARY KEY ("id"))`,
    );

    // Orders and their children
    await queryRunner.query(
      `CREATE TABLE "${s}"."orders" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "number" character varying(16) NOT NULL, "company_id" uuid NOT NULL, "type" "${s}"."order_type" NOT NULL, "status" "${s}"."order_status" NOT NULL, "services" "${s}"."service_kind" array NOT NULL DEFAULT '{}', "ref_number" character varying(32), "hub_id" uuid NOT NULL, "destination_hub_id" uuid, "scheduled_at" TIMESTAMP WITH TIME ZONE, "destination" character varying(120), "destination_note" character varying(160), "carrier_mode" "${s}"."carrier_mode", "carrier_id" uuid, "driver_id" uuid, "created_by_id" uuid NOT NULL, "assignee_id" uuid, "cargo_status" "${s}"."cargo_status" NOT NULL DEFAULT 'expected', "current_operation" "${s}"."operation_kind", "next_action" "${s}"."next_action_kind", "next_action_at" TIMESTAMP WITH TIME ZONE, "truck_number" character varying(16), "trailer_number" character varying(16), "trailer_type" "${s}"."trailer_type", "dock_number" smallint, "dock_bay" character varying(4), "dock_assigned_at" TIMESTAMP WITH TIME ZONE, "consolidated_trailers" smallint, "warehouse_note" text, "photos_count" integer NOT NULL DEFAULT '0', "messages_count" integer NOT NULL DEFAULT '0', "unread_messages_count" integer NOT NULL DEFAULT '0', "closed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_orders_number" UNIQUE ("number"), CONSTRAINT "pk_orders" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."sub_orders" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL, "number" character varying(20) NOT NULL, "ref_number" character varying(32) NOT NULL, "position" smallint NOT NULL, CONSTRAINT "uq_sub_orders_number" UNIQUE ("number"), CONSTRAINT "uq_sub_orders_order_id_position" UNIQUE ("order_id", "position"), CONSTRAINT "pk_sub_orders" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."cargo_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL, "sub_order_id" uuid, "unit_type" "${s}"."unit_type" NOT NULL, "declared_qty" integer NOT NULL, "actual_qty" integer, CONSTRAINT "pk_cargo_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."order_alerts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL, "sub_order_id" uuid, "kind" "${s}"."alert_kind" NOT NULL, "message" character varying(240) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "pk_order_alerts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."operations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL, "kind" "${s}"."operation_kind" NOT NULL, "billable" boolean NOT NULL, "trailer_number" character varying(16), "qty" integer NOT NULL, "unit_type" "${s}"."unit_type" NOT NULL, "rate_cents" integer NOT NULL DEFAULT '0', "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL, "comments_count" integer NOT NULL DEFAULT '0', "photos_count" integer NOT NULL DEFAULT '0', CONSTRAINT "pk_operations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."order_supplies" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL, "supply_item_id" uuid NOT NULL, "qty" integer NOT NULL, "unit_price_cents" integer NOT NULL, CONSTRAINT "pk_order_supplies" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "${s}"."invoices" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "number" character varying(16) NOT NULL, "order_id" uuid NOT NULL, "amount_cents" integer NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_invoices_number" UNIQUE ("number"), CONSTRAINT "uq_invoices_order_id" UNIQUE ("order_id"), CONSTRAINT "pk_invoices" PRIMARY KEY ("id"))`,
    );

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "idx_orders_company_id_status" ON "${s}"."orders" ("company_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_company_id_scheduled_at" ON "${s}"."orders" ("company_id", "scheduled_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_company_id_updated_at" ON "${s}"."orders" ("company_id", "updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cargo_items_order_id" ON "${s}"."cargo_items" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_alerts_order_id" ON "${s}"."order_alerts" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_operations_order_id" ON "${s}"."operations" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_supplies_order_id" ON "${s}"."order_supplies" ("order_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_invoices_paid_at" ON "${s}"."invoices" ("paid_at")`);

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "${s}"."users" ADD CONSTRAINT "fk_users_company_id" FOREIGN KEY ("company_id") REFERENCES "${s}"."companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."orders" ADD CONSTRAINT "fk_orders_company_id" FOREIGN KEY ("company_id") REFERENCES "${s}"."companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."orders" ADD CONSTRAINT "fk_orders_hub_id" FOREIGN KEY ("hub_id") REFERENCES "${s}"."hubs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."orders" ADD CONSTRAINT "fk_orders_destination_hub_id" FOREIGN KEY ("destination_hub_id") REFERENCES "${s}"."hubs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."orders" ADD CONSTRAINT "fk_orders_carrier_id" FOREIGN KEY ("carrier_id") REFERENCES "${s}"."carriers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."orders" ADD CONSTRAINT "fk_orders_driver_id" FOREIGN KEY ("driver_id") REFERENCES "${s}"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."orders" ADD CONSTRAINT "fk_orders_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "${s}"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."orders" ADD CONSTRAINT "fk_orders_assignee_id" FOREIGN KEY ("assignee_id") REFERENCES "${s}"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."sub_orders" ADD CONSTRAINT "fk_sub_orders_order_id" FOREIGN KEY ("order_id") REFERENCES "${s}"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."cargo_items" ADD CONSTRAINT "fk_cargo_items_order_id" FOREIGN KEY ("order_id") REFERENCES "${s}"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."cargo_items" ADD CONSTRAINT "fk_cargo_items_sub_order_id" FOREIGN KEY ("sub_order_id") REFERENCES "${s}"."sub_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."order_alerts" ADD CONSTRAINT "fk_order_alerts_order_id" FOREIGN KEY ("order_id") REFERENCES "${s}"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."order_alerts" ADD CONSTRAINT "fk_order_alerts_sub_order_id" FOREIGN KEY ("sub_order_id") REFERENCES "${s}"."sub_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."operations" ADD CONSTRAINT "fk_operations_order_id" FOREIGN KEY ("order_id") REFERENCES "${s}"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."order_supplies" ADD CONSTRAINT "fk_order_supplies_order_id" FOREIGN KEY ("order_id") REFERENCES "${s}"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."order_supplies" ADD CONSTRAINT "fk_order_supplies_supply_item_id" FOREIGN KEY ("supply_item_id") REFERENCES "${s}"."supply_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "${s}"."invoices" ADD CONSTRAINT "fk_invoices_order_id" FOREIGN KEY ("order_id") REFERENCES "${s}"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const s = appSchema(queryRunner);

    // Children first; dropping a table also drops its indexes and constraints.
    for (const table of [
      'invoices',
      'order_supplies',
      'operations',
      'order_alerts',
      'cargo_items',
      'sub_orders',
      'orders',
      'supply_items',
      'carriers',
      'hubs',
      'users',
      'companies',
    ]) {
      await queryRunner.query(`DROP TABLE "${s}"."${table}"`);
    }
    for (const type of [
      'alert_kind',
      'unit_type',
      'trailer_type',
      'next_action_kind',
      'operation_kind',
      'cargo_status',
      'carrier_mode',
      'service_kind',
      'order_status',
      'order_type',
      'supply_category',
      'user_role',
    ]) {
      await queryRunner.query(`DROP TYPE "${s}"."${type}"`);
    }
  }
}

function appSchema(queryRunner: QueryRunner): string {
  return resolveAppSchema((queryRunner.dataSource.options as { schema?: string }).schema);
}
