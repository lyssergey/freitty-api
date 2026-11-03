import { formatZonedDateTime } from '../../common/time/zoned-time.js';
import { toCsv, type CsvCell } from '../../common/utils/csv.js';
import type { NextActionKind, OrderStatus, OrderType, UnitType } from './order.enums.js';
import type { CargoSummary, CarrierSummary, OrderListItem } from './order.types.js';

// Human labels for the spreadsheet export (the UI keeps its own label maps).

const TYPE_LABEL: Record<OrderType, string> = {
  cross_dock: 'Cross-Dock',
  consolidation: 'Consolidation',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Draft',
  ready: 'New',
  in_progress: 'In progress',
  consolidated: 'Consolidated',
  in_transit: 'In transit',
  deconsolidated: 'Deconsolidated',
  closed: 'Completed',
};

const NEXT_ACTION_LABEL: Record<NextActionKind, string> = {
  await_truck: 'Waiting for truck',
  unloading: 'Unloading',
  loading: 'Loading',
  consolidation: 'Consolidation',
  dispatch: 'Dispatch',
  deconsolidation: 'Deconsolidation',
  delivery: 'Delivery',
  upload_photo: 'Upload photo',
  confirm_bol: 'Confirm BOL',
  book_delivery: 'Book delivery slot',
  approve_delta: 'Approve q-ty delta',
  pay_invoice: 'Pay invoice',
};

const UNIT_SHORT_LABEL: Record<UnitType, string> = { standard: 'Std', xl: 'XL' };

export const ORDERS_CSV_HEADER = [
  'Order',
  'Type',
  'Status',
  'Ref N',
  'Hub',
  'Destination hub',
  'Scheduled',
  'Destination',
  'Quantity',
  'Carrier',
  'Created by',
  'Next action',
  'Invoice',
  'Amount',
] as const;

/** RFC 4180 CSV of orders; dates in `timeZone` as `YYYY-MM-DD HH:mm`. */
export function ordersToCsv(orders: readonly OrderListItem[], timeZone: string): string {
  return toCsv(
    ORDERS_CSV_HEADER,
    orders.map((order) => orderCsvRow(order, timeZone)),
  );
}

export function orderCsvRow(order: OrderListItem, timeZone: string): CsvCell[] {
  return [
    order.number,
    TYPE_LABEL[order.type],
    STATUS_LABEL[order.status],
    order.refNumber ?? order.subOrders.map((subOrder) => subOrder.refNumber).join(', '),
    order.hub.name,
    order.destinationHub?.name,
    order.scheduledAt ? formatZonedDateTime(new Date(order.scheduledAt), timeZone) : null,
    [order.destination, order.destinationNote].filter(Boolean).join(' · '),
    formatQuantity(order.cargo),
    carrierLabel(order.carrier),
    order.createdBy.name,
    order.nextAction ? NEXT_ACTION_LABEL[order.nextAction.kind] : null,
    order.invoice ? `#${order.invoice.number}` : null,
    order.invoice ? formatAmount(order.invoice.amountCents) : null,
  ];
}

/** Declared quantity per unit type: `15 × Std + 12 × XL`. */
export function formatQuantity(cargo: readonly CargoSummary[]): string {
  return cargo.map((c) => `${c.declared} × ${UNIT_SHORT_LABEL[c.unitType]}`).join(' + ');
}

/** Cents as a plain decimal amount (`50800` → `508.00`), computed on integers. */
export function formatAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function carrierLabel(carrier: CarrierSummary | null): string | null {
  if (!carrier) return null;
  switch (carrier.mode) {
    case 'carrier':
      return carrier.name;
    case 'driver':
      return carrier.driver ? `Driver: ${carrier.driver.name}` : 'Driver';
    case 'self_pickup':
      return 'Self pickup';
  }
}
