import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type FindOptionsRelations } from 'typeorm';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { formatZonedDate } from '../../common/time/zoned-time.js';
import type { RootConfig } from '../../config/configuration.js';
import type { ListOrdersQuery } from './dto/order-filters.query.js';
import { CargoItem } from './entities/cargo-item.entity.js';
import { Operation } from './entities/operation.entity.js';
import { OrderAlert } from './entities/order-alert.entity.js';
import { OrderSupply } from './entities/order-supply.entity.js';
import { Order } from './entities/order.entity.js';
import { SubOrder } from './entities/sub-order.entity.js';
import {
  applyOrderFilters,
  orderPredicates,
  type OrderFilters,
  type OrderScope,
} from './order-filters.js';
import { ORDER_STATUS_LIFECYCLE, OrderSegment, OrderStatus } from './order.enums.js';
import { toOrderDetail, toOrderListItem } from './order.mapper.js';
import type {
  OrderBoardResponse,
  OrderDetail,
  OrderListItem,
  OrderListResponse,
  SegmentCounts,
} from './order.types.js';
import { ordersToCsv } from './orders-csv.js';

export const BOARD_COLUMN_LIMIT = 20;
export const EXPORT_ROW_LIMIT = 5000;

/** To-one relations of a list card: joined in one query, no row multiplication. */
const LIST_RELATIONS: FindOptionsRelations<Order> = {
  hub: true,
  destinationHub: true,
  carrier: true,
  driver: true,
  createdBy: true,
  invoice: true,
};

const DETAIL_RELATIONS: FindOptionsRelations<Order> = {
  ...LIST_RELATIONS,
  company: true,
  assignee: true,
};

@Injectable()
export class OrdersService {
  private readonly timeZone: string;

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(SubOrder) private readonly subOrders: Repository<SubOrder>,
    @InjectRepository(CargoItem) private readonly cargoItems: Repository<CargoItem>,
    @InjectRepository(OrderAlert) private readonly alerts: Repository<OrderAlert>,
    @InjectRepository(Operation) private readonly operations: Repository<Operation>,
    @InjectRepository(OrderSupply) private readonly supplies: Repository<OrderSupply>,
    config: ConfigService<RootConfig, true>,
  ) {
    this.timeZone = config.get('app', { infer: true }).timezone;
  }

  /** One page of orders (updated_at DESC) plus the per-tab counts under the same filters. */
  async list(user: AuthUser, query: ListOrdersQuery): Promise<OrderListResponse> {
    const scope = this.scope(user);
    const { page, pageSize, ...filters } = query;
    const [counts, ids] = await Promise.all([
      this.segmentCounts(scope, filters),
      this.sortedIds(scope, filters, { offset: (page - 1) * pageSize, limit: pageSize }),
    ]);
    const total = counts[filters.segment];
    return {
      items: await this.listItems(ids),
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
      counts,
    };
  }

  /** All statuses as kanban columns, each with its newest orders and its full count. */
  async board(user: AuthUser, filters: OrderFilters): Promise<OrderBoardResponse> {
    const rows = await this.boardRows(this.scope(user), filters);
    const items = new Map((await this.listItems(rows.map((row) => row.id))).map((i) => [i.id, i]));
    return {
      columns: ORDER_STATUS_LIFECYCLE.map((status) => {
        const inColumn = rows.filter((row) => row.status === status);
        return {
          status,
          count: Number(inColumn[0]?.columnCount ?? 0),
          items: inColumn.flatMap((row) => items.get(row.id) ?? []),
        };
      }),
    };
  }

  /** CSV of the filtered orders (same order as the list), capped at `EXPORT_ROW_LIMIT` rows. */
  async exportCsv(
    user: AuthUser,
    filters: OrderFilters,
  ): Promise<{ filename: string; csv: string }> {
    const scope = this.scope(user);
    const ids = await this.sortedIds(scope, filters, { offset: 0, limit: EXPORT_ROW_LIMIT });
    return {
      filename: `freitty-orders-${formatZonedDate(scope.now, this.timeZone)}.csv`,
      csv: ordersToCsv(await this.listItems(ids), this.timeZone),
    };
  }

  async detail(user: AuthUser, number: string): Promise<OrderDetail> {
    const order = await this.orders.findOne({
      where: { companyId: user.companyId, number },
      relations: DETAIL_RELATIONS,
    });
    if (!order) throw new NotFoundException(`Order ${number} not found`);

    const [operations, supplies] = await Promise.all([
      this.operations.find({ where: { orderId: order.id }, order: { appliedAt: 'ASC' } }),
      this.supplies.find({ where: { orderId: order.id }, relations: { supplyItem: true } }),
      this.withChildren([order]),
    ]);
    order.operations = operations;
    order.supplies = supplies;
    return toOrderDetail(order);
  }

  /** List items for these ids, preserving their order. */
  async listItems(ids: string[]): Promise<OrderListItem[]> {
    if (ids.length === 0) return [];
    const orders = await this.orders.find({ where: { id: In(ids) }, relations: LIST_RELATIONS });
    const byId = new Map((await this.withChildren(orders)).map((order) => [order.id, order]));
    return ids.flatMap((id) => {
      const order = byId.get(id);
      return order ? [toOrderListItem(order)] : [];
    });
  }

  private scope(user: AuthUser): OrderScope {
    return { companyId: user.companyId, now: new Date(), timeZone: this.timeZone };
  }

  /** Per-tab totals in one scan: `COUNT(*) FILTER (WHERE <segment>)` for every segment. */
  private async segmentCounts(scope: OrderScope, filters: OrderFilters): Promise<SegmentCounts> {
    const qb = applyOrderFilters(this.orders.createQueryBuilder('o'), scope, {
      ...filters,
      segment: undefined,
    });
    const predicates = orderPredicates(qb);
    const segments = Object.values(OrderSegment);
    qb.select([]); // drop the default `o.*` selection
    for (const segment of segments) {
      const predicate = predicates.segment(segment);
      qb.addSelect(predicate ? `COUNT(*) FILTER (WHERE ${predicate})` : 'COUNT(*)', segment);
    }
    const raw = await qb.getRawOne<Record<OrderSegment, string>>();
    return Object.fromEntries(
      segments.map((segment) => [segment, Number(raw?.[segment] ?? 0)]),
    ) as SegmentCounts;
  }

  /**
   * The newest `BOARD_COLUMN_LIMIT` order ids of every status column plus each
   * column's full count, in one query: window functions rank and count the
   * filtered orders per status, the outer query keeps the top of each column.
   */
  private boardRows(
    scope: OrderScope,
    filters: OrderFilters,
  ): Promise<Array<{ id: string; status: OrderStatus; columnCount: string }>> {
    return this.orders.manager
      .createQueryBuilder()
      .select('ranked.id', 'id')
      .addSelect('ranked.status', 'status')
      .addSelect('ranked.column_count', 'columnCount')
      .from(
        (sub) =>
          applyOrderFilters(
            sub
              .select('o.id', 'id')
              .addSelect('o.status', 'status')
              .addSelect('COUNT(*) OVER (PARTITION BY o.status)', 'column_count')
              .addSelect(
                'ROW_NUMBER() OVER (PARTITION BY o.status ORDER BY o.updated_at DESC, o.number DESC)',
                'column_rank',
              )
              .from(Order, 'o'),
            scope,
            { ...filters, status: undefined }, // the columns are the statuses
          ),
        'ranked',
      )
      .where('ranked.column_rank <= :limit', { limit: BOARD_COLUMN_LIMIT })
      .orderBy('ranked.column_rank', 'ASC')
      .getRawMany();
  }

  /** Ids of the filtered orders, newest activity first. */
  private async sortedIds(
    scope: OrderScope,
    filters: OrderFilters,
    window: { offset: number; limit: number },
  ): Promise<string[]> {
    const rows = await applyOrderFilters(this.orders.createQueryBuilder('o'), scope, filters)
      .select('o.id', 'id')
      .orderBy('o.updated_at', 'DESC')
      .addOrderBy('o.number', 'DESC')
      .offset(window.offset)
      .limit(window.limit)
      .getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }

  /**
   * Attaches sub-orders, cargo lines and alerts. Loaded as separate queries in
   * parallel — joining these collections would multiply rows (sub-orders × cargo ×
   * alerts), and TypeORM's `relationLoadStrategy: 'query'` runs them one by one.
   */
  private async withChildren(orders: Order[]): Promise<Order[]> {
    if (orders.length === 0) return orders;
    const orderId = In(orders.map((order) => order.id));
    const [subOrders, cargoItems, alerts] = await Promise.all([
      this.subOrders.find({ where: { orderId }, order: { position: 'ASC' } }),
      this.cargoItems.find({ where: { orderId } }),
      this.alerts.find({ where: { orderId }, order: { createdAt: 'DESC' } }),
    ]);
    const subOrdersOf = groupBy(subOrders, (row) => row.orderId);
    const cargoOf = groupBy(cargoItems, (row) => row.orderId);
    const alertsOf = groupBy(alerts, (row) => row.orderId);
    for (const order of orders) {
      order.subOrders = subOrdersOf.get(order.id) ?? [];
      order.cargoItems = cargoOf.get(order.id) ?? [];
      order.alerts = alertsOf.get(order.id) ?? [];
    }
    return orders;
  }
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group) group.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}
