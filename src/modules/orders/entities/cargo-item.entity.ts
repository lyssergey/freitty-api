import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { UnitType } from '../order.enums.js';
import { Order } from './order.entity.js';
import { SubOrder } from './sub-order.entity.js';

/**
 * A cargo line: declared (BOL) vs actual (counted at the warehouse) quantity of
 * one unit type. Consolidation cargo hangs off sub-orders; cross-dock cargo has
 * no sub-order. An order's quantity is all its lines aggregated per unit type.
 */
@Entity('cargo_items')
export class CargoItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.cargoItems, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @Column({ type: 'uuid', nullable: true })
  subOrderId!: string | null;

  @ManyToOne(() => SubOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sub_order_id' })
  subOrder!: Relation<SubOrder> | null;

  @Column({ type: 'enum', enum: UnitType, enumName: 'unit_type' })
  unitType!: UnitType;

  @Column({ type: 'int' })
  declaredQty!: number;

  /** Null until the cargo is counted. */
  @Column({ type: 'int', nullable: true })
  actualQty!: number | null;
}
