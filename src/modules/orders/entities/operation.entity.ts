import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { OperationKind, UnitType } from '../order.enums.js';
import { Order } from './order.entity.js';

/**
 * A warehouse operation applied to an order's cargo (unloading, restack, …).
 * Amount = billable ? qty × rateCents : 0 — computed, never stored.
 */
@Entity('operations')
export class Operation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.operations, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @Column({ type: 'enum', enum: OperationKind, enumName: 'operation_kind' })
  kind!: OperationKind;

  @Column({ type: 'boolean' })
  billable!: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true })
  trailerNumber!: string | null;

  @Column({ type: 'int' })
  qty!: number;

  @Column({ type: 'enum', enum: UnitType, enumName: 'unit_type' })
  unitType!: UnitType;

  /** Price per unit. */
  @Column({ type: 'int', default: 0 })
  rateCents!: number;

  @Column({ type: 'timestamptz' })
  appliedAt!: Date;

  @Column({ type: 'int', default: 0 })
  commentsCount!: number;

  @Column({ type: 'int', default: 0 })
  photosCount!: number;
}
