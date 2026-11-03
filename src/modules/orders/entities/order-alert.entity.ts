import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { AlertKind } from '../order.enums.js';
import { Order } from './order.entity.js';
import { SubOrder } from './sub-order.entity.js';

/** A problem raised on an order (optionally on one sub-order). Open while `resolvedAt` is null. */
@Entity('order_alerts')
export class OrderAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.alerts, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @Column({ type: 'uuid', nullable: true })
  subOrderId!: string | null;

  @ManyToOne(() => SubOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sub_order_id' })
  subOrder!: Relation<SubOrder> | null;

  @Column({ type: 'enum', enum: AlertKind, enumName: 'alert_kind' })
  kind!: AlertKind;

  @Column({ type: 'varchar', length: 240 })
  message!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
