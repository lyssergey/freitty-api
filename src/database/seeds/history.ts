import { addCalendarDays, toZonedParts, zonedTimeToUtc } from '../../common/time/zoned-time.js';
import {
  AlertKind,
  CargoStatus,
  CarrierMode,
  OperationKind,
  OrderStatus,
  OrderType,
  ServiceKind,
  TrailerType,
  UNIT_TYPE_ORDER,
  UnitType,
} from '../../modules/orders/order.enums.js';
import { addMinutes, type SeedClock } from './clock.js';
import type { Random } from './prng.js';
import { CARRIERS, HUB_CITY, HUB_FLOOR_LEAD, HUBS, SUPPLY_CATALOG } from './reference-data.js';
import type {
  AlertSpec,
  CargoSpec,
  CarrierSpec,
  HubCode,
  OperationSpec,
  OrderSpec,
  UserKey,
} from './seed-types.js';

/** History starts this many days before the seed day. */
const OLDEST_DAYS_AGO = 540;

/**
 * Closed orders per rolling KPI window (dashboard "Completed (30 d)"). With the
 * featured FR001672 and FR001668 the last 30 days hold 24 closings — the same as
 * the 30 days before, i.e. "same as last month".
 */
const CLOSED_LAST_30D = 22;
const CLOSED_PREVIOUS_30D = 24;

/** Historical numbers come from FR001200…FR001667 (FR001383 is a featured order). */
const NUMBER_POOL = Array.from({ length: 1667 - 1200 + 1 }, (_, i) => 1200 + i)
  .filter((n) => n !== 1383)
  .map((n) => `FR${String(n).padStart(6, '0')}`);

const DESTINATIONS = [
  'Toronto, ON',
  'Ottawa, ON',
  'Hamilton, ON',
  'London, ON',
  'Kingston, ON',
  'Montréal, QC',
  'Québec City, QC',
  'Winnipeg, MB',
  'Calgary, AB',
  'Edmonton, AB',
  'Vancouver, BC',
  'Halifax, NS',
  'Detroit, MI',
  'Buffalo, NY',
  'Chicago, IL',
  'Cleveland, OH',
  'Pittsburgh, PA',
];

const WAREHOUSE_NOTES = [
  'Shrink wrap torn on one pallet — rewrapped before loading.',
  'Truck arrived 40 min early, unloaded at the next free dock.',
  'Two pallets restacked to fit the trailer height.',
  'BOL signed with a note on the seal number.',
  'Client asked to keep pallets grouped by PO.',
];

const RESOLVED_ALERT_MESSAGES: Record<AlertKind, string> = {
  [AlertKind.PHOTO_MISSING]: 'Cargo photo was missing — uploaded by the client.',
  [AlertKind.QTY_MISMATCH]: 'Counted quantity did not match the BOL — delta approved.',
  [AlertKind.DAMAGED_CARGO]: 'Damaged pallet found on arrival — client notified.',
  [AlertKind.LATE_ARRIVAL]: 'Truck arrived after the booked slot — rescheduled.',
};

const DOCK_BAYS = ['A', 'B', 'C', 'D'];

/**
 * ~380 closed orders spread over the last 540 days (deterministic for a given
 * `now`). Numbers and client refs are assigned in creation order, so the newest
 * historical order is FR001667. Every historical order is older (by updated_at =
 * closed_at, before 16:00 yesterday at the latest) than every featured order.
 */
export function historicalOrders(rng: Random, clock: SeedClock): OrderSpec[] {
  const specs = closingTimes(rng, clock).map((closedAt) => closedOrder(rng, clock, closedAt));
  if (specs.length > NUMBER_POOL.length) {
    throw new Error(`History needs ${specs.length} numbers, the pool has ${NUMBER_POOL.length}`);
  }

  specs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const numbers = NUMBER_POOL.slice(NUMBER_POOL.length - specs.length);
  let lastRef = 0;
  const nextRef = () => `REF-${String(++lastRef).padStart(4, '0')}`;
  specs.forEach((spec, index) => {
    spec.number = numbers[index]!;
    if (spec.type === OrderType.CROSS_DOCK) spec.refNumber = nextRef();
    for (const subOrder of spec.subOrders ?? []) subOrder.ref = nextRef();
  });
  return specs;
}

/**
 * When orders were closed, oldest first. The two rolling 30-day windows hold exact
 * counts; their closings stay at least a day inside the older window edges (days
 * 1–28 and 31–58 ago) so the dashboard numbers survive a day of clock drift after
 * seeding. Two closings land yesterday and one the day before, so the Day activity
 * chart compares 2 with 1 rather than an empty day; yesterday's are before 16:00
 * local, i.e. more than 8 h ago and older than every featured order. Older weeks
 * follow a gently growing, seasonal weekly rate.
 */
function closingTimes(rng: Random, clock: SeedClock): Date[] {
  const closingOn = (daysAgo: number) => clock.day(-daysAgo, randomTime(rng, 7, 19));
  const yesterdayBefore16 = () => clock.day(-1, randomTime(rng, 7, 16)); // 07:00–15:55
  const spread = (count: number, firstDay: number, lastDay: number) =>
    Array.from({ length: count }, (_, i) =>
      closingOn(firstDay + Math.floor(((i + rng.float()) * (lastDay - firstDay + 1)) / count)),
    );

  const times = [
    yesterdayBefore16(),
    yesterdayBefore16(),
    closingOn(2),
    ...spread(CLOSED_LAST_30D - 3, 3, 28),
    ...spread(CLOSED_PREVIOUS_30D, 31, 58),
  ];

  const firstOlderDay = 61;
  for (let weekStart = firstOlderDay; weekStart <= OLDEST_DAYS_AGO; weekStart += 7) {
    const progress = 1 - (weekStart - firstOlderDay) / (OLDEST_DAYS_AGO - firstOlderDay);
    const season = Math.sin((2 * Math.PI * weekOfYear(clock.day(-weekStart, '12:00'), clock)) / 52);
    const rate = 4.2 + 1.4 * progress + 0.8 * season;
    const count = Math.max(0, Math.round(rate + (rng.float() * 2 - 1) * 1.2));
    for (let i = 0; i < count; i++) {
      times.push(closingOn(Math.min(OLDEST_DAYS_AGO, weekStart + rng.int(0, 6))));
    }
  }
  return times.sort((a, b) => a.getTime() - b.getTime());
}

function closedOrder(rng: Random, clock: SeedClock, closedAt: Date): OrderSpec {
  const type = rng.chance(0.72) ? OrderType.CROSS_DOCK : OrderType.CONSOLIDATION;
  const hub: HubCode = rng.chance(0.6) ? 'MAR' : 'TOR';
  const destinationHub: HubCode | undefined =
    type === OrderType.CONSOLIDATION && rng.chance(0.25)
      ? hub === 'MAR'
        ? 'TOR'
        : 'MAR'
      : undefined;
  const services = type === OrderType.CROSS_DOCK ? crossDockServices(rng) : [];
  const carrier = carrierFor(rng, services);
  const createdBy = rng.weighted<UserKey>([
    ['U1', 30],
    ['U2', 30],
    ['U3', 25],
    ['U4', 15],
  ]);

  const scheduledAt = scheduledBefore(rng, clock, closedAt);
  const createdAt = addMinutes(scheduledAt, -rng.int(24 * 60, 6 * 24 * 60));

  // Cargo: on the order for cross-docks, one line per sub-order for consolidations.
  const cargo = type === OrderType.CROSS_DOCK ? crossDockCargo(rng) : undefined;
  const subOrders =
    type === OrderType.CONSOLIDATION
      ? Array.from({ length: rng.int(2, 4) }, () => ({ ref: '', cargo: [consolidationLine(rng)] }))
      : undefined;
  const lines = cargo ?? subOrders!.flatMap((subOrder) => subOrder.cargo);

  const trailerNumber = `TRL-${rng.int(1000, 9999)}`;
  const dockCount = HUBS.find((h) => h.code === hub)!.dockCount;
  const issuedAt = addMinutes(closedAt, rng.int(0, 120));
  const paidAt = addMinutes(issuedAt, rng.int(12 * 60, 5 * 24 * 60));

  return {
    number: '', // assigned in creation order by historicalOrders()
    type,
    status: OrderStatus.CLOSED,
    services,
    hub,
    destinationHub,
    scheduledAt,
    destination: destinationHub ? HUB_CITY[destinationHub] : rng.pick(DESTINATIONS),
    destinationNote: rng.weighted<string | undefined>([
      [undefined, 88],
      ['via External PDF', 8],
      ['Order with photos', 4],
    ]),
    carrier,
    createdBy,
    assignee: HUB_FLOOR_LEAD[hub],
    cargoStatus: CargoStatus.DISPATCHED,
    truckNumber: `TRK-${rng.int(1000, 9999)}`,
    trailerNumber,
    trailerType: rng.weighted([
      [TrailerType.VAN_53, 70],
      [TrailerType.REEFER_53, 15],
      [TrailerType.FLATBED_48, 10],
      [TrailerType.STRAIGHT_26, 5],
    ]),
    dock: rng.chance(0.7)
      ? {
          number: rng.int(1, dockCount),
          bay: rng.pick(DOCK_BAYS),
          assignedAt: addMinutes(scheduledAt, -rng.int(30, 180)),
        }
      : undefined,
    consolidatedTrailers: type === OrderType.CONSOLIDATION ? rng.int(1, 2) : undefined,
    warehouseNote: rng.chance(0.1) ? rng.pick(WAREHOUSE_NOTES) : undefined,
    photos: rng.int(0, 8),
    messages: { total: rng.int(0, 6), unread: 0 },
    createdAt,
    updatedAt: closedAt, // payment lives on the invoice, not on the order
    closedAt,
    cargo,
    subOrders,
    alerts: rng.chance(0.04)
      ? [resolvedAlert(rng, scheduledAt, closedAt, subOrders?.length ?? 0)]
      : undefined,
    operations: operationsFor(rng, { type, services, lines, scheduledAt, closedAt, trailerNumber }),
    supplies: rng.chance(0.6)
      ? rng
          .sample(SUPPLY_CATALOG, rng.int(1, 3))
          .map((item) => ({ sku: item.sku, qty: rng.int(1, 16) }))
      : undefined,
    invoice: { issuedAt, paidAt: paidAt <= clock.now ? paidAt : null },
  };
}

function crossDockServices(rng: Random): ServiceKind[] {
  const services: ServiceKind[] = [
    rng.weighted([
      [ServiceKind.STORAGE, 35],
      [ServiceKind.PICKUP, 25],
      [ServiceKind.TRANSLOAD, 40],
    ]),
  ];
  if (rng.chance(0.15)) services.push(ServiceKind.RESTOCK_REWORK);
  if (rng.chance(0.1)) services.push(ServiceKind.LABELING);
  if (rng.chance(0.1)) services.push(ServiceKind.SHRINK_WRAP);
  return services;
}

/** Pickup orders are mostly collected by the client themselves. */
function carrierFor(rng: Random, services: ServiceKind[]): CarrierSpec {
  const mode = services.includes(ServiceKind.PICKUP)
    ? rng.weighted([
        [CarrierMode.SELF_PICKUP, 50],
        [CarrierMode.CARRIER, 40],
        [CarrierMode.DRIVER, 10],
      ])
    : rng.weighted([
        [CarrierMode.CARRIER, 80],
        [CarrierMode.DRIVER, 10],
        [CarrierMode.SELF_PICKUP, 10],
      ]);
  switch (mode) {
    case CarrierMode.CARRIER:
      return { mode, name: rng.pick(CARRIERS).name };
    case CarrierMode.DRIVER:
      return { mode, driver: rng.pick<UserKey>(['U5', 'U8']) };
    case CarrierMode.SELF_PICKUP:
      return { mode };
  }
}

function crossDockCargo(rng: Random): CargoSpec[] {
  const mix = rng.weighted([
    ['standard', 75],
    ['xl', 15],
    ['both', 10],
  ]);
  const lines: CargoSpec[] = [];
  if (mix !== 'xl') lines.push(countedLine(rng, UnitType.STANDARD, rng.int(4, 26)));
  if (mix !== 'standard') lines.push(countedLine(rng, UnitType.XL, rng.int(2, 12)));
  return lines;
}

function consolidationLine(rng: Random): CargoSpec {
  return rng.chance(0.8)
    ? countedLine(rng, UnitType.STANDARD, rng.int(4, 20))
    : countedLine(rng, UnitType.XL, rng.int(2, 10));
}

/** 85% of counts match the BOL; the rest are off by 1–2 units. */
function countedLine(rng: Random, unitType: UnitType, declared: number): CargoSpec {
  if (rng.chance(0.85)) return { unitType, declared, actual: declared };
  const delta = rng.int(1, 2) * (rng.chance(0.5) ? 1 : -1);
  return { unitType, declared, actual: Math.max(1, declared + delta) };
}

/** A slot 0–3 local days before the closing, between 07:00 and 17:00 local. */
function scheduledBefore(rng: Random, clock: SeedClock, closedAt: Date): Date {
  const date = addCalendarDays(toZonedParts(closedAt, clock.timeZone), -rng.int(0, 3));
  const slot = zonedTimeToUtc(
    { ...date, hour: rng.int(7, 16), minute: rng.int(0, 11) * 5 },
    clock.timeZone,
  );
  // A same-day slot after the closing is impossible: move it a few hours earlier.
  return slot.getTime() < addMinutes(closedAt, -30).getTime()
    ? slot
    : addMinutes(closedAt, -rng.int(90, 300));
}

/**
 * Warehouse operations between the scheduled slot and the closing. Cross-dock:
 * unloading + loading per cargo line (a transload service replaces both with a
 * transload), optional restack (20%), disposal (5%) and wrapping (shrink-wrap
 * service). Consolidation: unloading per sub-order, then consolidation and loading.
 * Operations on the whole cargo are booked per unit type (standard first).
 */
function operationsFor(
  rng: Random,
  order: {
    type: OrderType;
    services: ServiceKind[];
    lines: CargoSpec[];
    scheduledAt: Date;
    closedAt: Date;
    trailerNumber: string;
  },
): OperationSpec[] {
  const span = order.closedAt.getTime() - order.scheduledAt.getTime();
  const at = (fraction: number) =>
    new Date(Math.round((order.scheduledAt.getTime() + span * fraction) / 60_000) * 60_000);
  const counted = (line: CargoSpec) => line.actual ?? line.declared;
  // The whole cargo per unit type, so XL pallets are shown as XL and loaded at the XL rate.
  const perUnit = UNIT_TYPE_ORDER.flatMap((unitType) => {
    const ofType = order.lines.filter((line) => line.unitType === unitType);
    return ofType.length > 0
      ? [{ unitType, qty: ofType.reduce((sum, line) => sum + counted(line), 0) }]
      : [];
  });
  const mainUnit = [...order.lines].sort((a, b) => b.declared - a.declared)[0]!.unitType;
  const trailer = order.trailerNumber;
  const ops: OperationSpec[] = [];

  if (order.type === OrderType.CONSOLIDATION) {
    order.lines.forEach((line, i) =>
      ops.push({
        kind: OperationKind.UNLOADING,
        qty: counted(line),
        unitType: line.unitType,
        at: at(0.05 + (0.3 * i) / order.lines.length),
        photos: rng.int(0, 3),
      }),
    );
    for (const cargo of perUnit) {
      ops.push({ kind: OperationKind.CONSOLIDATION, ...cargo, at: at(0.5) });
    }
    for (const cargo of perUnit) {
      ops.push({ kind: OperationKind.LOADING, ...cargo, at: at(0.85), trailer });
    }
    return ops;
  }

  const transload = order.services.includes(ServiceKind.TRANSLOAD);
  if (transload) {
    // One transload, booked per unit type: its photos go on the first line.
    const photos = rng.int(0, 3);
    perUnit.forEach((cargo, i) =>
      ops.push({
        kind: OperationKind.TRANSLOAD,
        ...cargo,
        at: at(0.3),
        trailer,
        photos: i === 0 ? photos : 0,
      }),
    );
  } else {
    for (const line of order.lines) {
      ops.push({
        kind: OperationKind.UNLOADING,
        qty: counted(line),
        unitType: line.unitType,
        at: at(0.1),
        trailer,
        photos: rng.int(0, 4),
      });
    }
  }
  if (rng.chance(0.2)) {
    for (const cargo of perUnit) {
      ops.push({ kind: OperationKind.RESTACK, ...cargo, at: at(0.4) });
    }
  }
  if (rng.chance(0.05)) {
    ops.push({
      kind: OperationKind.DISPOSAL,
      qty: 1,
      unitType: mainUnit,
      at: at(0.5),
      comments: 1,
      photos: rng.int(1, 3),
    });
  }
  if (order.services.includes(ServiceKind.SHRINK_WRAP)) {
    for (const cargo of perUnit) {
      ops.push({ kind: OperationKind.WRAPPING, ...cargo, at: at(0.6) });
    }
  }
  if (!transload) {
    for (const line of order.lines) {
      ops.push({
        kind: OperationKind.LOADING,
        qty: counted(line),
        unitType: line.unitType,
        at: at(0.85),
        trailer,
      });
    }
  }
  return ops;
}

function resolvedAlert(
  rng: Random,
  scheduledAt: Date,
  closedAt: Date,
  subOrderCount: number,
): AlertSpec {
  const kind = rng.pick(Object.values(AlertKind));
  const createdAt = new Date(
    scheduledAt.getTime() + (closedAt.getTime() - scheduledAt.getTime()) * 0.3,
  );
  const resolvedAt = addMinutes(createdAt, rng.int(30, 600));
  return {
    kind,
    message: RESOLVED_ALERT_MESSAGES[kind],
    createdAt,
    resolvedAt: resolvedAt < closedAt ? resolvedAt : closedAt,
    subOrder: subOrderCount > 0 ? rng.int(1, subOrderCount) : undefined,
  };
}

/** Zero-based week of the (local) year, for the seasonal component. */
function weekOfYear(instant: Date, clock: SeedClock): number {
  const p = toZonedParts(instant, clock.timeZone);
  return Math.floor(
    (Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / (7 * 86_400_000),
  );
}

/** `HH:MM` between `fromHour`:00 and `toHour`:00 local, in 5-minute steps. */
function randomTime(rng: Random, fromHour: number, toHour: number): string {
  const hour = rng.int(fromHour, toHour - 1);
  const minute = rng.int(0, 11) * 5;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
