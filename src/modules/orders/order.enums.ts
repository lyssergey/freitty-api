/**
 * Order domain vocabulary. The string values are the API contract shared with the
 * frontend (and the Postgres enum labels), so never rename a value in place.
 */

export const OrderType = {
  CROSS_DOCK: 'cross_dock',
  CONSOLIDATION: 'consolidation',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

/** Declared in lifecycle order — the board columns and status flows rely on it. */
export const OrderStatus = {
  DRAFT: 'draft',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  CONSOLIDATED: 'consolidated',
  IN_TRANSIT: 'in_transit',
  DECONSOLIDATED: 'deconsolidated',
  CLOSED: 'closed',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_LIFECYCLE: readonly OrderStatus[] = Object.values(OrderStatus);

/** Statuses of an order that is being worked on (neither a draft nor closed). */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.READY,
  OrderStatus.IN_PROGRESS,
  OrderStatus.CONSOLIDATED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DECONSOLIDATED,
];

export const UnitType = {
  STANDARD: 'standard',
  XL: 'xl',
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

/** Display/aggregation order of unit types: standard first, then XL. */
export const UNIT_TYPE_ORDER: readonly UnitType[] = Object.values(UnitType);

export const ServiceKind = {
  STORAGE: 'storage',
  PICKUP: 'pickup',
  TRANSLOAD: 'transload',
  RESTOCK_REWORK: 'restock_rework',
  LABELING: 'labeling',
  SHRINK_WRAP: 'shrink_wrap',
} as const;
export type ServiceKind = (typeof ServiceKind)[keyof typeof ServiceKind];

export const CarrierMode = {
  CARRIER: 'carrier',
  DRIVER: 'driver',
  SELF_PICKUP: 'self_pickup',
} as const;
export type CarrierMode = (typeof CarrierMode)[keyof typeof CarrierMode];

export const CargoStatus = {
  EXPECTED: 'expected',
  ON_STOCK: 'on_stock',
  DISPATCHED: 'dispatched',
} as const;
export type CargoStatus = (typeof CargoStatus)[keyof typeof CargoStatus];

export const OperationKind = {
  UNLOADING: 'unloading',
  LOADING: 'loading',
  RESTACK: 'restack',
  DISPOSAL: 'disposal',
  TRANSLOAD: 'transload',
  CONSOLIDATION: 'consolidation',
  DECONSOLIDATION: 'deconsolidation',
  WRAPPING: 'wrapping',
} as const;
export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];

export const NextActionKind = {
  AWAIT_TRUCK: 'await_truck',
  UNLOADING: 'unloading',
  LOADING: 'loading',
  CONSOLIDATION: 'consolidation',
  DISPATCH: 'dispatch',
  DECONSOLIDATION: 'deconsolidation',
  DELIVERY: 'delivery',
  UPLOAD_PHOTO: 'upload_photo',
  CONFIRM_BOL: 'confirm_bol',
  BOOK_DELIVERY: 'book_delivery',
  APPROVE_DELTA: 'approve_delta',
  PAY_INVOICE: 'pay_invoice',
} as const;
export type NextActionKind = (typeof NextActionKind)[keyof typeof NextActionKind];

/** Next actions owned by the client ("requires your action"); the rest are warehouse work. */
export const CLIENT_NEXT_ACTIONS: readonly NextActionKind[] = [
  NextActionKind.UPLOAD_PHOTO,
  NextActionKind.CONFIRM_BOL,
  NextActionKind.BOOK_DELIVERY,
  NextActionKind.APPROVE_DELTA,
  NextActionKind.PAY_INVOICE,
];

export const AlertKind = {
  PHOTO_MISSING: 'photo_missing',
  QTY_MISMATCH: 'qty_mismatch',
  DAMAGED_CARGO: 'damaged_cargo',
  LATE_ARRIVAL: 'late_arrival',
} as const;
export type AlertKind = (typeof AlertKind)[keyof typeof AlertKind];

export const TrailerType = {
  VAN_53: 'van_53',
  REEFER_53: 'reefer_53',
  FLATBED_48: 'flatbed_48',
  STRAIGHT_26: 'straight_26',
} as const;
export type TrailerType = (typeof TrailerType)[keyof typeof TrailerType];

/** Tabs of the order list. */
export const OrderSegment = {
  ALL: 'all',
  CROSS_DOCK: 'cross_dock',
  CONSOLIDATION: 'consolidation',
  ALERTS: 'alerts',
  DRAFTS: 'drafts',
  ATTENTION: 'attention',
} as const;
export type OrderSegment = (typeof OrderSegment)[keyof typeof OrderSegment];
