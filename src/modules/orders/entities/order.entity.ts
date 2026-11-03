import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Carrier } from '../../carriers/carrier.entity.js';
import { Company } from '../../companies/company.entity.js';
import { Hub } from '../../hubs/hub.entity.js';
import { User } from '../../users/user.entity.js';
import {
  CargoStatus,
  CarrierMode,
  NextActionKind,
  OperationKind,
  OrderStatus,
  OrderType,
  ServiceKind,
  TrailerType,
} from '../order.enums.js';
import { CargoItem } from './cargo-item.entity.js';
import { Invoice } from './invoice.entity.js';
import { Operation } from './operation.entity.js';
import { OrderAlert } from './order-alert.entity.js';
import { OrderSupply } from './order-supply.entity.js';
import { SubOrder } from './sub-order.entity.js';

/**
 * A client order handled by a hub: a cross-dock (one client ref, cargo on the order)
 * or a consolidation (several sub-orders, each with its own ref and cargo). The
 * indexes follow the list/board/dashboard access paths, all scoped by company.
 */
@Entity('orders')
@Index(['companyId', 'updatedAt'])
@Index(['companyId', 'scheduledAt'])
@Index(['companyId', 'status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Human-facing number: `FR001676`, drafts `DRAFT-003`. */
  @Column({ type: 'varchar', length: 16, unique: true })
  number!: string;

  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: Relation<Company>;

  @Column({ type: 'enum', enum: OrderType, enumName: 'order_type' })
  type!: OrderType;

  @Column({ type: 'enum', enum: OrderStatus, enumName: 'order_status' })
  status!: OrderStatus;

  @Column({ type: 'enum', enum: ServiceKind, enumName: 'service_kind', array: true, default: [] })
  services!: ServiceKind[];

  /** Client reference of a cross-dock order (consolidations keep refs on sub-orders). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  refNumber!: string | null;

  @Column({ type: 'uuid' })
  hubId!: string;

  @ManyToOne(() => Hub, { nullable: false })
  @JoinColumn({ name: 'hub_id' })
  hub!: Relation<Hub>;

  /** Hub the cargo moves to (hub-to-hub consolidations). */
  @Column({ type: 'uuid', nullable: true })
  destinationHubId!: string | null;

  @ManyToOne(() => Hub)
  @JoinColumn({ name: 'destination_hub_id' })
  destinationHub!: Relation<Hub> | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  /** Free-text final destination, e.g. `Toronto, ON`. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  destination!: string | null;

  /** e.g. `via External PDF`. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  destinationNote!: string | null;

  /** How the cargo leaves: a carrier company, our driver, or picked up by the client. */
  @Column({ type: 'enum', enum: CarrierMode, enumName: 'carrier_mode', nullable: true })
  carrierMode!: CarrierMode | null;

  @Column({ type: 'uuid', nullable: true })
  carrierId!: string | null;

  @ManyToOne(() => Carrier)
  @JoinColumn({ name: 'carrier_id' })
  carrier!: Relation<Carrier> | null;

  @Column({ type: 'uuid', nullable: true })
  driverId!: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver!: Relation<User> | null;

  @Column({ type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: Relation<User>;

  /** Hub staff member handling the order (floor lead). */
  @Column({ type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assignee_id' })
  assignee!: Relation<User> | null;

  @Column({
    type: 'enum',
    enum: CargoStatus,
    enumName: 'cargo_status',
    default: CargoStatus.EXPECTED,
  })
  cargoStatus!: CargoStatus;

  /** Warehouse operation happening right now (e.g. loading). */
  @Column({ type: 'enum', enum: OperationKind, enumName: 'operation_kind', nullable: true })
  currentOperation!: OperationKind | null;

  @Column({ type: 'enum', enum: NextActionKind, enumName: 'next_action_kind', nullable: true })
  nextAction!: NextActionKind | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextActionAt!: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  truckNumber!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  trailerNumber!: string | null;

  @Column({ type: 'enum', enum: TrailerType, enumName: 'trailer_type', nullable: true })
  trailerType!: TrailerType | null;

  @Column({ type: 'smallint', nullable: true })
  dockNumber!: number | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  dockBay!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  dockAssignedAt!: Date | null;

  @Column({ type: 'smallint', nullable: true })
  consolidatedTrailers!: number | null;

  @Column({ type: 'text', nullable: true })
  warehouseNote!: string | null;

  @Column({ type: 'int', default: 0 })
  photosCount!: number;

  @Column({ type: 'int', default: 0 })
  messagesCount!: number;

  @Column({ type: 'int', default: 0 })
  unreadMessagesCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => SubOrder, (subOrder) => subOrder.order)
  subOrders!: Relation<SubOrder[]>;

  @OneToMany(() => CargoItem, (item) => item.order)
  cargoItems!: Relation<CargoItem[]>;

  @OneToMany(() => OrderAlert, (alert) => alert.order)
  alerts!: Relation<OrderAlert[]>;

  @OneToMany(() => Operation, (operation) => operation.order)
  operations!: Relation<Operation[]>;

  @OneToMany(() => OrderSupply, (supply) => supply.order)
  supplies!: Relation<OrderSupply[]>;

  @OneToOne(() => Invoice, (invoice) => invoice.order)
  invoice!: Relation<Invoice> | null;
}
