import { toHubRef } from '../hubs/hub.ref.js';
import { SUPPLY_CATEGORY_ORDER } from '../supplies/supply-category.js';
import { toUserRef } from '../users/user.ref.js';
import type { CargoItem } from './entities/cargo-item.entity.js';
import type { Operation } from './entities/operation.entity.js';
import type { OrderAlert } from './entities/order-alert.entity.js';
import type { OrderSupply } from './entities/order-supply.entity.js';
import type { Order } from './entities/order.entity.js';
import type { SubOrder } from './entities/sub-order.entity.js';
import {
  CLIENT_NEXT_ACTIONS,
  UNIT_TYPE_ORDER,
  UnitType,
  type NextActionKind,
} from './order.enums.js';
import type {
  CargoDelta,
  CargoSummary,
  CarrierSummary,
  OrderDetail,
  OrderListItem,
  OrderOperationItem,
  OrderSupplyItem,
  SubOrderSummary,
} from './order.types.js';

// Pure entity → response mapping. Callers load the relations; nothing here
// touches the database, so the business rules below are unit-tested directly.

type CargoLine = Pick<CargoItem, 'unitType' | 'declaredQty' | 'actualQty'>;

const iso = (date: Date): string => date.toISOString();
const isoOrNull = (date: Date | null): string | null => (date ? date.toISOString() : null);
const sum = <T>(items: readonly T[], value: (item: T) => number): number =>
  items.reduce((total, item) => total + value(item), 0);

export function isClientAction(kind: NextActionKind): boolean {
  return CLIENT_NEXT_ACTIONS.includes(kind);
}

/** Declared and counted totals of some cargo lines; `actual` is null while none was counted. */
function cargoTotals(lines: readonly CargoLine[]): { declared: number; actual: number | null } {
  const counted = lines.filter((line) => line.actualQty !== null);
  return {
    declared: sum(lines, (line) => line.declaredQty),
    actual: counted.length > 0 ? sum(counted, (line) => line.actualQty ?? 0) : null,
  };
}

/** Sums cargo lines per unit type, standard first. */
export function summarizeCargo(lines: readonly CargoLine[]): CargoSummary[] {
  return UNIT_TYPE_ORDER.flatMap((unitType) => {
    const ofType = lines.filter((line) => line.unitType === unitType);
    return ofType.length > 0 ? [{ unitType, ...cargoTotals(ofType) }] : [];
  });
}

/** Unit types whose counted quantity differs from the declared (BOL) one. */
export function cargoDeltas(cargo: readonly CargoSummary[]): CargoDelta[] {
  return cargo.flatMap(({ unitType, declared, actual }) =>
    actual !== null && actual !== declared
      ? [{ unitType, declared, actual, diff: actual - declared }]
      : [],
  );
}

export function toOrderListItem(order: Order): OrderListItem {
  const subOrders = [...order.subOrders].sort((a, b) => a.position - b.position);
  const openAlerts = order.alerts
    .filter((alert) => alert.resolvedAt === null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));

  return {
    id: order.id,
    number: order.number,
    type: order.type,
    status: order.status,
    services: order.services,
    refNumber: order.refNumber,
    subOrders: subOrders.map((subOrder) =>
      toSubOrderSummary(subOrder, order.cargoItems, openAlerts),
    ),
    hub: toHubRef(order.hub),
    destinationHub: order.destinationHub ? toHubRef(order.destinationHub) : null,
    scheduledAt: isoOrNull(order.scheduledAt),
    destination: order.destination,
    destinationNote: order.destinationNote,
    cargo: summarizeCargo(order.cargoItems),
    carrier: toCarrierSummary(order),
    createdBy: toUserRef(order.createdBy),
    consolidatedTrailers: order.consolidatedTrailers,
    nextAction: order.nextAction
      ? {
          kind: order.nextAction,
          dueAt: isoOrNull(order.nextActionAt),
          requiresClient: isClientAction(order.nextAction),
        }
      : null,
    openAlerts: openAlerts.map((alert) => ({
      id: alert.id,
      kind: alert.kind,
      message: alert.message,
      subOrderNumber: subOrders.find((s) => s.id === alert.subOrderId)?.number ?? null,
      createdAt: iso(alert.createdAt),
    })),
    invoice: order.invoice
      ? {
          number: order.invoice.number,
          amountCents: order.invoice.amountCents,
          issuedAt: iso(order.invoice.issuedAt),
          paidAt: isoOrNull(order.invoice.paidAt),
        }
      : null,
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    closedAt: isoOrNull(order.closedAt),
  };
}

export function toOrderDetail(order: Order): OrderDetail {
  const item = toOrderListItem(order);
  const operations = [...order.operations]
    .sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime() || a.id.localeCompare(b.id))
    .map(toOperationItem);
  const supplies = [...order.supplies].sort(bySupplyCategoryThenName).map(toSupplyItem);
  const operationsCents = sum(operations, (op) => op.amountCents);
  const suppliesCents = sum(supplies, (line) => line.lineTotalCents);

  return {
    ...item,
    company: { id: order.company.id, name: order.company.name },
    cargoStatus: order.cargoStatus,
    currentOperation: order.currentOperation,
    truckNumber: order.truckNumber,
    trailerNumber: order.trailerNumber,
    trailerType: order.trailerType,
    dock:
      order.dockNumber !== null
        ? {
            number: order.dockNumber,
            bay: order.dockBay,
            assignedAt: isoOrNull(order.dockAssignedAt),
            hubDockCount: order.hub.dockCount,
          }
        : null,
    assignee: order.assignee ? toUserRef(order.assignee) : null,
    warehouseNote: order.warehouseNote,
    photosCount: order.photosCount,
    messages: { total: order.messagesCount, unread: order.unreadMessagesCount },
    deltas: cargoDeltas(item.cargo),
    operations,
    supplies,
    totals: { operationsCents, suppliesCents, totalCents: operationsCents + suppliesCents },
  };
}

function toSubOrderSummary(
  subOrder: SubOrder,
  cargoItems: readonly CargoItem[],
  openAlertsNewestFirst: readonly OrderAlert[],
): SubOrderSummary {
  const lines = cargoItems.filter((line) => line.subOrderId === subOrder.id);
  const { declared, actual } = cargoTotals(lines);
  // Largest declared quantity wins; ties keep the standard-first order.
  const mainUnit = summarizeCargo(lines).reduce<CargoSummary | null>(
    (main, cargo) => (!main || cargo.declared > main.declared ? cargo : main),
    null,
  );
  // The first (oldest) open alert raised on this sub-order.
  const alert = openAlertsNewestFirst.filter((a) => a.subOrderId === subOrder.id).at(-1);
  return {
    id: subOrder.id,
    number: subOrder.number,
    refNumber: subOrder.refNumber,
    unitType: mainUnit?.unitType ?? UnitType.STANDARD,
    declaredQty: declared,
    actualQty: actual,
    alert: alert ? { kind: alert.kind, message: alert.message } : null,
  };
}

function toCarrierSummary(order: Order): CarrierSummary | null {
  if (!order.carrierMode) return null;
  return {
    mode: order.carrierMode,
    name: order.carrier?.name ?? null,
    phone: order.carrier?.phone ?? null,
    driver: order.driver ? toUserRef(order.driver) : null,
  };
}

function toOperationItem(op: Operation): OrderOperationItem {
  return {
    id: op.id,
    kind: op.kind,
    billable: op.billable,
    trailerNumber: op.trailerNumber,
    qty: op.qty,
    unitType: op.unitType,
    rateCents: op.rateCents,
    amountCents: op.billable ? op.qty * op.rateCents : 0,
    appliedAt: iso(op.appliedAt),
    commentsCount: op.commentsCount,
    photosCount: op.photosCount,
  };
}

function toSupplyItem(line: OrderSupply): OrderSupplyItem {
  return {
    id: line.id,
    sku: line.supplyItem.sku,
    name: line.supplyItem.name,
    category: line.supplyItem.category,
    qty: line.qty,
    unitPriceCents: line.unitPriceCents,
    lineTotalCents: line.qty * line.unitPriceCents,
  };
}

function bySupplyCategoryThenName(a: OrderSupply, b: OrderSupply): number {
  return (
    SUPPLY_CATEGORY_ORDER.indexOf(a.supplyItem.category) -
      SUPPLY_CATEGORY_ORDER.indexOf(b.supplyItem.category) ||
    a.supplyItem.name.localeCompare(b.supplyItem.name)
  );
}
