import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Order } from './order.entity.js';

/**
 * One client shipment inside a consolidation (`FR001676-1`), with its own ref.
 * The unique (order_id, position) also serves lookups by order.
 */
@Entity('sub_orders')
@Unique(['orderId', 'position'])
export class SubOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.subOrders, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @Column({ type: 'varchar', length: 20, unique: true })
  number!: string;

  @Column({ type: 'varchar', length: 32 })
  refNumber!: string;

  /** 1-based position within the order. */
  @Column({ type: 'smallint' })
  position!: number;
}
