import type { HubRef } from '../hubs/hub.ref.js';
import type { SupplyCategory } from '../supplies/supply-category.js';
import type { UserRef } from '../users/user.ref.js';
import type {
  AlertKind,
  CargoStatus,
  CarrierMode,
  NextActionKind,
  OperationKind,
  OrderSegment,
  OrderStatus,
  OrderType,
  ServiceKind,
  TrailerType,
  UnitType,
} from './order.enums.js';

// Response contract of the orders endpoints. Dates are ISO-8601 UTC strings and
// money is integer cents.

/** Quantity of one unit type, summed over an order's cargo lines. */
export interface CargoSummary {
  unitType: UnitType;
  declared: number;
  /** Sum of counted quantities; null while nothing has been counted. */
  actual: number | null;
}

export interface SubOrderSummary {
  id: string;
  number: string;
  refNumber: string;
  /** Unit type with the largest declared quantity. */
  unitType: UnitType;
  declaredQty: number;
  actualQty: number | null;
  /** First open alert raised on this sub-order. */
  alert: { kind: AlertKind; message: string } | null;
}

export interface CarrierSummary {
  mode: CarrierMode;
  /** Carrier company (mode `carrier`). */
  name: string | null;
  phone: string | null;
  /** Our driver (mode `driver`). */
  driver: UserRef | null;
}

export interface NextAction {
  kind: NextActionKind;
  dueAt: string | null;
  /** Owned by the client ("requires your action"). */
  requiresClient: boolean;
}

export interface OpenAlert {
  id: string;
  kind: AlertKind;
  message: string;
  subOrderNumber: string | null;
  createdAt: string;
}

export interface InvoiceSummary {
  number: string;
  amountCents: number;
  issuedAt: string;
  paidAt: string | null;
}

export interface OrderListItem {
  id: string;
  number: string;
  type: OrderType;
  status: OrderStatus;
  services: ServiceKind[];
  refNumber: string | null;
  /** By position; empty for cross-docks. */
  subOrders: SubOrderSummary[];
  hub: HubRef;
  destinationHub: HubRef | null;
  scheduledAt: string | null;
  destination: string | null;
  destinationNote: string | null;
  /** Standard first, then XL; empty when there is no cargo. */
  cargo: CargoSummary[];
  /** Null when no carrier is chosen yet (drafts). */
  carrier: CarrierSummary | null;
  createdBy: UserRef;
  consolidatedTrailers: number | null;
  nextAction: NextAction | null;
  /** Newest first. */
  openAlerts: OpenAlert[];
  invoice: InvoiceSummary | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

/** A unit type whose counted quantity differs from the BOL. */
export interface CargoDelta {
  unitType: UnitType;
  declared: number;
  actual: number;
  diff: number;
}

export interface OrderOperationItem {
  id: string;
  kind: OperationKind;
  billable: boolean;
  trailerNumber: string | null;
  qty: number;
  unitType: UnitType;
  rateCents: number;
  /** billable ? qty × rateCents : 0 */
  amountCents: number;
  appliedAt: string;
  commentsCount: number;
  photosCount: number;
}

export interface OrderSupplyItem {
  id: string;
  sku: string;
  name: string;
  category: SupplyCategory;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderDetail extends OrderListItem {
  company: { id: string; name: string };
  cargoStatus: CargoStatus;
  currentOperation: OperationKind | null;
  truckNumber: string | null;
  trailerNumber: string | null;
  trailerType: TrailerType | null;
  dock: {
    number: number;
    bay: string | null;
    assignedAt: string | null;
    hubDockCount: number;
  } | null;
  assignee: UserRef | null;
  warehouseNote: string | null;
  photosCount: number;
  messages: { total: number; unread: number };
  deltas: CargoDelta[];
  /** Oldest first. */
  operations: OrderOperationItem[];
  /** Grouped by category (catalog order), then by name. */
  supplies: OrderSupplyItem[];
  totals: { operationsCents: number; suppliesCents: number; totalCents: number };
}

export type SegmentCounts = Record<OrderSegment, number>;

export interface OrderListResponse {
  items: OrderListItem[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  /** Per-tab totals under the same hub / period / status / search filters. */
  counts: SegmentCounts;
}

export interface OrderBoardColumn {
  status: OrderStatus;
  /** All orders in this status (the column shows at most `BOARD_COLUMN_LIMIT`). */
  count: number;
  items: OrderListItem[];
}

export interface OrderBoardResponse {
  /** Every status, in lifecycle order. */
  columns: OrderBoardColumn[];
}
