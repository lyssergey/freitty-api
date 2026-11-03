import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { SupplyItem } from '../../supplies/supply-item.entity.js';
import { Order } from './order.entity.js';

/** A catalog item sold on an order. Line total = qty × unitPriceCents. */
@Entity('order_supplies')
export class OrderSupply {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.supplies, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @Column({ type: 'uuid' })
  supplyItemId!: string;

  @ManyToOne(() => SupplyItem, { nullable: false })
  @JoinColumn({ name: 'supply_item_id' })
  supplyItem!: Relation<SupplyItem>;

  @Column({ type: 'int' })
  qty!: number;

  /** Catalog price when the item was added (later catalog changes don't rewrite history). */
  @Column({ type: 'int' })
  unitPriceCents!: number;
}
