import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { datePresetRange, type DatePreset } from '../../common/time/periods.js';
import { containsPattern } from '../../common/utils/like.js';
import { tableName } from '../../database/table-name.js';
import { Carrier } from '../carriers/carrier.entity.js';
import { Hub } from '../hubs/hub.entity.js';
import { OrderAlert } from './entities/order-alert.entity.js';
import { SubOrder } from './entities/sub-order.entity.js';
import {
  ACTIVE_ORDER_STATUSES,
  CLIENT_NEXT_ACTIONS,
  OrderSegment,
  OrderStatus,
  OrderType,
} from './order.enums.js';

/** Filters shared by the order list, its tab counts, the board and the CSV export. */
export interface OrderFilters {
  /** Omitted for the tab counts, which apply every segment at once. */
  segment?: OrderSegment;
  /** Hub code, e.g. `MAR`. */
  hub?: string;
  period: DatePreset;
  status?: OrderStatus;
  /** Trimmed search text. */
  q?: string;
}

/** Whose orders, and "now" in the business time zone (periods use local days). */
export interface OrderScope {
  companyId: string;
  now: Date;
  timeZone: string;
}

/** The order date the period filter applies to. */
const ORDER_DATE = 'COALESCE(o.scheduled_at, o.created_at)';

/** SQL predicates over the orders alias `o`: the vocabulary of the list tabs and the KPIs. */
export interface OrderPredicates {
  /** Being worked on: neither a draft nor closed. */
  active: string;
  /** Waiting on a client-owned next action ("requires your action"). */
  clientAction: string;
  /** Has at least one unresolved alert. */
  openAlert: string;
  /** Predicate of a list tab; `null` means no restriction. */
  segment(segment: OrderSegment): string | null;
}

/** Builds the predicates for `qb` and binds the parameters they reference on it. */
export function orderPredicates(qb: SelectQueryBuilder<ObjectLiteral>): OrderPredicates {
  qb.setParameters({
    activeStatuses: [...ACTIVE_ORDER_STATUSES],
    clientActions: [...CLIENT_NEXT_ACTIONS],
  });
  const active = 'o.status IN (:...activeStatuses)';
  const clientAction = 'o.next_action IN (:...clientActions)';
  const openAlert = `EXISTS (
    SELECT 1 FROM ${tableName(qb.dataSource, OrderAlert)} oa
    WHERE oa.order_id = o.id AND oa.resolved_at IS NULL)`;

  return {
    active,
    clientAction,
    openAlert,
    segment(segment) {
      switch (segment) {
        case OrderSegment.ALL:
          return null;
        case OrderSegment.CROSS_DOCK:
          return `o.type = '${OrderType.CROSS_DOCK}'`;
        case OrderSegment.CONSOLIDATION:
          return `o.type = '${OrderType.CONSOLIDATION}'`;
        case OrderSegment.ALERTS:
          return openAlert;
        case OrderSegment.DRAFTS:
          return `o.status = '${OrderStatus.DRAFT}'`;
        case OrderSegment.ATTENTION:
          return `(${active} AND (${openAlert} OR ${clientAction}))`;
      }
    },
  };
}

/**
 * The single place where order filters become SQL. Restricts `qb` (orders aliased
 * `o`) to the company's orders matching the hub, the period (on the order date in
 * the business time zone), the status, the search text and, when given, the
 * segment.
 */
export function applyOrderFilters<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  scope: OrderScope,
  filters: OrderFilters,
): SelectQueryBuilder<T> {
  qb.where('o.company_id = :companyId', { companyId: scope.companyId });

  if (filters.hub) {
    qb.andWhere(
      `o.hub_id = (SELECT h.id FROM ${tableName(qb.dataSource, Hub)} h WHERE h.code = :hubCode)`,
      {
        hubCode: filters.hub,
      },
    );
  }

  const period = datePresetRange(filters.period, scope.now, scope.timeZone);
  if (period.from) qb.andWhere(`${ORDER_DATE} >= :periodFrom`, { periodFrom: period.from });
  if (period.to) qb.andWhere(`${ORDER_DATE} < :periodTo`, { periodTo: period.to });

  if (filters.status) qb.andWhere('o.status = :status', { status: filters.status });

  if (filters.q) {
    qb.andWhere(
      `(o.number ILIKE :q OR o.ref_number ILIKE :q OR o.destination ILIKE :q
        OR EXISTS (SELECT 1 FROM ${tableName(qb.dataSource, Carrier)} c
                   WHERE c.id = o.carrier_id AND c.name ILIKE :q)
        OR EXISTS (SELECT 1 FROM ${tableName(qb.dataSource, SubOrder)} so
                   WHERE so.order_id = o.id AND (so.number ILIKE :q OR so.ref_number ILIKE :q)))`,
      { q: containsPattern(filters.q) },
    );
  }

  const segment = filters.segment ? orderPredicates(qb).segment(filters.segment) : null;
  if (segment) qb.andWhere(segment);
  return qb;
}
