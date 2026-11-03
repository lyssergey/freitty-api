import { CargoStatus, CarrierMode } from '../../modules/orders/order.enums.js';
import { operationTariff } from './reference-data.js';
import type { Random } from './prng.js';
import type {
  CargoItemRow,
  OrderDraft,
  OrderSpec,
  ReferenceData,
  SubOrderRow,
} from './seed-types.js';

/**
 * Turns a readable order spec (featured or generated) into table rows: ids, FKs,
 * operation tariffs, supply price snapshots and the invoice amount (billable
 * operations + supplies). The single place both seed sources go through.
 */
export function materializeOrder(spec: OrderSpec, ref: ReferenceData, ids: Random): OrderDraft {
  const orderId = ids.uuid();
  const carrier = spec.carrier;

  const subOrders: SubOrderRow[] = [];
  const cargoItems: CargoItemRow[] = [];
  const cargoLine = (line: NonNullable<OrderSpec['cargo']>[number], subOrderId: string | null) =>
    cargoItems.push({
      id: ids.uuid(),
      orderId,
      subOrderId,
      unitType: line.unitType,
      declaredQty: line.declared,
      actualQty: line.actual,
    });

  for (const line of spec.cargo ?? []) cargoLine(line, null);
  (spec.subOrders ?? []).forEach((subOrder, index) => {
    const row: SubOrderRow = {
      id: ids.uuid(),
      orderId,
      number: `${spec.number}-${index + 1}`,
      refNumber: subOrder.ref,
      position: index + 1,
    };
    subOrders.push(row);
    for (const line of subOrder.cargo) cargoLine(line, row.id);
  });

  const alerts = (spec.alerts ?? []).map((alert) => ({
    id: ids.uuid(),
    orderId,
    subOrderId: alert.subOrder ? subOrderAt(subOrders, alert.subOrder, spec.number).id : null,
    kind: alert.kind,
    message: alert.message,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt ?? null,
  }));

  const operations = (spec.operations ?? []).map((op) => ({
    id: ids.uuid(),
    orderId,
    kind: op.kind,
    ...operationTariff(op.kind, op.unitType),
    trailerNumber: op.trailer ?? null,
    qty: op.qty,
    unitType: op.unitType,
    appliedAt: op.at,
    commentsCount: op.comments ?? 0,
    photosCount: op.photos ?? 0,
  }));

  const orderSupplies = (spec.supplies ?? []).map(({ sku, qty }) => {
    const item = ref.supplyItems.get(sku);
    if (!item) throw new Error(`${spec.number}: unknown supply SKU ${sku}`);
    return {
      id: ids.uuid(),
      orderId,
      supplyItemId: item.id,
      qty,
      unitPriceCents: item.unitPriceCents,
    };
  });

  const amountCents =
    operations.reduce((sum, op) => sum + (op.billable ? op.qty * op.rateCents : 0), 0) +
    orderSupplies.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);

  const carrierRow =
    carrier?.mode === CarrierMode.CARRIER ? ref.carriers.get(carrier.name) : undefined;
  if (carrier?.mode === CarrierMode.CARRIER && !carrierRow) {
    throw new Error(`${spec.number}: unknown carrier ${carrier.name}`);
  }

  return {
    order: {
      id: orderId,
      number: spec.number,
      companyId: ref.company.id,
      type: spec.type,
      status: spec.status,
      services: spec.services ?? [],
      refNumber: spec.refNumber ?? null,
      hubId: ref.hubs[spec.hub].id,
      destinationHubId: spec.destinationHub ? ref.hubs[spec.destinationHub].id : null,
      scheduledAt: spec.scheduledAt,
      destination: spec.destination ?? null,
      destinationNote: spec.destinationNote ?? null,
      carrierMode: carrier?.mode ?? null,
      carrierId: carrierRow?.id ?? null,
      driverId: carrier?.mode === CarrierMode.DRIVER ? ref.users[carrier.driver].id : null,
      createdById: ref.users[spec.createdBy].id,
      assigneeId: spec.assignee ? ref.users[spec.assignee].id : null,
      cargoStatus: spec.cargoStatus ?? CargoStatus.EXPECTED,
      currentOperation: spec.currentOperation ?? null,
      nextAction: spec.nextAction?.kind ?? null,
      nextActionAt: spec.nextAction?.at ?? null,
      truckNumber: spec.truckNumber ?? null,
      trailerNumber: spec.trailerNumber ?? null,
      trailerType: spec.trailerType ?? null,
      dockNumber: spec.dock?.number ?? null,
      dockBay: spec.dock?.bay ?? null,
      dockAssignedAt: spec.dock?.assignedAt ?? null,
      consolidatedTrailers: spec.consolidatedTrailers ?? null,
      warehouseNote: spec.warehouseNote ?? null,
      photosCount: spec.photos ?? 0,
      messagesCount: spec.messages?.total ?? 0,
      unreadMessagesCount: spec.messages?.unread ?? 0,
      closedAt: spec.closedAt ?? null,
      createdAt: spec.createdAt,
      updatedAt: spec.updatedAt,
    },
    subOrders,
    cargoItems,
    alerts,
    operations,
    orderSupplies,
    invoice: spec.invoice
      ? {
          id: ids.uuid(),
          orderId,
          amountCents,
          issuedAt: spec.invoice.issuedAt,
          paidAt: spec.invoice.paidAt,
        }
      : null,
  };
}

function subOrderAt(subOrders: SubOrderRow[], position: number, orderNumber: string): SubOrderRow {
  const subOrder = subOrders.find((s) => s.position === position);
  if (!subOrder) throw new Error(`${orderNumber}: no sub-order at position ${position}`);
  return subOrder;
}
