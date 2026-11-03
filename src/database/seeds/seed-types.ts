import type { Carrier } from '../../modules/carriers/carrier.entity.js';
import type { Company } from '../../modules/companies/company.entity.js';
import type { Hub } from '../../modules/hubs/hub.entity.js';
import type { CargoItem } from '../../modules/orders/entities/cargo-item.entity.js';
import type { Invoice } from '../../modules/orders/entities/invoice.entity.js';
import type { Operation } from '../../modules/orders/entities/operation.entity.js';
import type { OrderAlert } from '../../modules/orders/entities/order-alert.entity.js';
import type { OrderSupply } from '../../modules/orders/entities/order-supply.entity.js';
import type { Order } from '../../modules/orders/entities/order.entity.js';
import type { SubOrder } from '../../modules/orders/entities/sub-order.entity.js';
import type {
  AlertKind,
  CargoStatus,
  CarrierMode,
  NextActionKind,
  OperationKind,
  OrderStatus,
  OrderType,
  ServiceKind,
  TrailerType,
  UnitType,
} from '../../modules/orders/order.enums.js';
import type { SupplyItem } from '../../modules/supplies/supply-item.entity.js';
import type { User } from '../../modules/users/user.entity.js';

// Plain rows as inserted: entity columns without the relation properties.
export type CompanyRow = Company;
export type UserRow = Omit<User, 'company'>;
export type HubRow = Hub;
export type CarrierRow = Carrier;
export type SupplyItemRow = SupplyItem;
export type OrderRow = Omit<
  Order,
  | 'company'
  | 'hub'
  | 'destinationHub'
  | 'carrier'
  | 'driver'
  | 'createdBy'
  | 'assignee'
  | 'subOrders'
  | 'cargoItems'
  | 'alerts'
  | 'operations'
  | 'supplies'
  | 'invoice'
>;
export type SubOrderRow = Omit<SubOrder, 'order'>;
export type CargoItemRow = Omit<CargoItem, 'order' | 'subOrder'>;
export type OrderAlertRow = Omit<OrderAlert, 'order' | 'subOrder'>;
export type OperationRow = Omit<Operation, 'order'>;
export type OrderSupplyRow = Omit<OrderSupply, 'order' | 'supplyItem'>;
export type InvoiceRow = Omit<Invoice, 'order'>;

export type UserKey = 'U1' | 'U2' | 'U3' | 'U4' | 'U5' | 'U6' | 'U7' | 'U8';
export type HubCode = 'MAR' | 'TOR';

/** Everything `buildDataset` produces, one array per table, in insert (FK) order. */
export interface Dataset {
  companies: CompanyRow[];
  users: UserRow[];
  hubs: HubRow[];
  carriers: CarrierRow[];
  supplyItems: SupplyItemRow[];
  orders: OrderRow[];
  subOrders: SubOrderRow[];
  cargoItems: CargoItemRow[];
  alerts: OrderAlertRow[];
  operations: OperationRow[];
  orderSupplies: OrderSupplyRow[];
  invoices: InvoiceRow[];
}

/** Reference rows keyed the way order specs refer to them. */
export interface ReferenceData {
  company: CompanyRow;
  users: Record<UserKey, UserRow>;
  hubs: Record<HubCode, HubRow>;
  carriers: Map<string, CarrierRow>;
  supplyItems: Map<string, SupplyItemRow>;
}

export interface CargoSpec {
  unitType: UnitType;
  declared: number;
  actual: number | null;
}

export type CarrierSpec =
  | { mode: typeof CarrierMode.CARRIER; name: string }
  | { mode: typeof CarrierMode.DRIVER; driver: UserKey }
  | { mode: typeof CarrierMode.SELF_PICKUP };

export interface OperationSpec {
  kind: OperationKind;
  qty: number;
  unitType: UnitType;
  at: Date;
  trailer?: string;
  photos?: number;
  comments?: number;
}

export interface AlertSpec {
  kind: AlertKind;
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
  /** 1-based position of the sub-order the alert is about. */
  subOrder?: number;
}

/** A readable description of one order; `materializeOrder` turns it into rows. */
export interface OrderSpec {
  number: string;
  type: OrderType;
  status: OrderStatus;
  services?: ServiceKind[];
  /** Cross-dock client ref. */
  refNumber?: string;
  hub: HubCode;
  destinationHub?: HubCode;
  scheduledAt: Date | null;
  destination?: string;
  destinationNote?: string;
  carrier?: CarrierSpec;
  createdBy: UserKey;
  assignee?: UserKey;
  cargoStatus?: CargoStatus;
  currentOperation?: OperationKind;
  nextAction?: { kind: NextActionKind; at: Date };
  truckNumber?: string;
  trailerNumber?: string;
  trailerType?: TrailerType;
  dock?: { number: number; bay: string; assignedAt: Date };
  consolidatedTrailers?: number;
  warehouseNote?: string;
  photos?: number;
  messages?: { total: number; unread: number };
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  /** Cross-dock cargo lines. */
  cargo?: CargoSpec[];
  /** Consolidation sub-orders, in position order. */
  subOrders?: Array<{ ref: string; cargo: CargoSpec[] }>;
  alerts?: AlertSpec[];
  operations?: OperationSpec[];
  supplies?: Array<{ sku: string; qty: number }>;
  /** Invoice numbers are assigned later, sequentially across all invoices. */
  invoice?: { issuedAt: Date; paidAt: Date | null };
}

/** One order with all its child rows; the invoice is still unnumbered. */
export interface OrderDraft {
  order: OrderRow;
  subOrders: SubOrderRow[];
  cargoItems: CargoItemRow[];
  alerts: OrderAlertRow[];
  operations: OperationRow[];
  orderSupplies: OrderSupplyRow[];
  invoice: Omit<InvoiceRow, 'number'> | null;
}
