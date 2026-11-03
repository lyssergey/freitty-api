import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Order } from './order.entity.js';

/**
 * The invoice of a closed order (at most one per order). The amount is a snapshot
 * of billable operations + supplies at invoicing; "spend" analytics sum it by
 * `paidAt`.
 */
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Six digits, displayed as `#001812`. */
  @Column({ type: 'varchar', length: 16, unique: true })
  number!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @OneToOne(() => Order, (order) => order.invoice, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @Column({ type: 'int' })
  amountCents!: number;

  @Column({ type: 'timestamptz' })
  issuedAt!: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  paidAt!: Date | null;
}
