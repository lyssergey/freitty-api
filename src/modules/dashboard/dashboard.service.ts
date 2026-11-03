import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  ACTIVITY_BUCKETS,
  completedWindows,
  DAY_MS,
  type ActivityPeriod,
} from '../../common/time/periods.js';
import type { RootConfig } from '../../config/configuration.js';
import { tableName } from '../../database/table-name.js';
import { Invoice } from '../orders/entities/invoice.entity.js';
import { OrderAlert } from '../orders/entities/order-alert.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { orderPredicates } from '../orders/order-filters.js';
import { OrderStatus, type AlertKind } from '../orders/order.enums.js';
import type { OrderListItem } from '../orders/order.types.js';
import { OrdersService } from '../orders/orders.service.js';
import { summarizeActivity } from './activity.js';
import { activitySql, type ActivityRow } from './activity.sql.js';
import type { DashboardActivity, DashboardSummary } from './dashboard.types.js';

const ATTENTION_ALERTS_LIMIT = 5;

@Injectable()
export class DashboardService {
  private readonly timeZone: string;

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderAlert) private readonly alerts: Repository<OrderAlert>,
    private readonly ordersService: OrdersService,
    config: ConfigService<RootConfig, true>,
  ) {
    this.timeZone = config.get('app', { infer: true }).timezone;
  }

  /** KPI cards: all counters in one scan of the company's orders, plus the newest alerts. */
  async summary(user: AuthUser): Promise<DashboardSummary> {
    const now = new Date();
    const { last30d, previous30d } = completedWindows(now);
    const qb = this.orders
      .createQueryBuilder('o')
      .where('o.company_id = :companyId', { companyId: user.companyId });
    const is = orderPredicates(qb);
    const closedBetween = (after: string, until: string) =>
      `o.status = '${OrderStatus.CLOSED}' AND o.closed_at > :${after} AND o.closed_at <= :${until}`;

    qb.select(`COUNT(*) FILTER (WHERE ${is.active})`, 'active')
      .addSelect(
        `COUNT(*) FILTER (WHERE ${is.active} AND o.created_at >= :weekAgo)`,
        'createdThisWeek',
      )
      .addSelect(`COUNT(*) FILTER (WHERE ${closedBetween('monthAgo', 'now')})`, 'last30d')
      .addSelect(
        `COUNT(*) FILTER (WHERE ${closedBetween('twoMonthsAgo', 'monthAgo')})`,
        'previous30d',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE ${is.active} AND ${is.clientAction} AND NOT ${is.openAlert})`,
        'awaitingAction',
      )
      .addSelect(`COUNT(*) FILTER (WHERE ${is.active} AND ${is.openAlert})`, 'alertOrders')
      .setParameters({
        now,
        weekAgo: new Date(now.getTime() - 7 * DAY_MS),
        monthAgo: last30d.after,
        twoMonthsAgo: previous30d.after,
      });

    const [raw, alerts] = await Promise.all([
      qb.getRawOne<Record<string, string>>(),
      this.newestOpenAlerts(user),
    ]);
    const count = (key: string) => Number(raw?.[key] ?? 0);
    return {
      activeOrders: { count: count('active'), createdThisWeek: count('createdThisWeek') },
      completed: { last30d: count('last30d'), previous30d: count('previous30d') },
      needAttention: {
        total: count('awaitingAction') + count('alertOrders'),
        awaitingAction: count('awaitingAction'),
        alertOrders: count('alertOrders'),
        alerts,
      },
    };
  }

  /** The newest non-draft orders, as full list cards. */
  async recentOrders(user: AuthUser, limit: number): Promise<{ items: OrderListItem[] }> {
    const rows = await this.orders
      .createQueryBuilder('o')
      .select('o.id', 'id')
      .where('o.company_id = :companyId', { companyId: user.companyId })
      .andWhere('o.status <> :draft', { draft: OrderStatus.DRAFT })
      .orderBy('o.updated_at', 'DESC')
      .addOrderBy('o.number', 'DESC')
      .limit(limit)
      .getRawMany<{ id: string }>();
    return { items: await this.ordersService.listItems(rows.map((row) => row.id)) };
  }

  /** Completed orders and spend per calendar bucket (see `activitySql`). */
  async activity(user: AuthUser, period: ActivityPeriod): Promise<DashboardActivity> {
    const { unit, step, count } = ACTIVITY_BUCKETS[period];
    const { dataSource } = this.orders.manager;
    const sql = activitySql({
      orders: tableName(dataSource, Order),
      invoices: tableName(dataSource, Invoice),
    });
    const rows = await this.orders.query<Array<Record<keyof ActivityRow, string | number>>>(sql, [
      user.companyId,
      this.timeZone,
      unit,
      step,
      count,
      new Date(),
    ]);
    const buckets = rows.map((row) => ({
      start: String(row.start),
      completed: Number(row.completed),
      spendCents: Number(row.spendCents), // bigint arrives as a string
      paidInvoices: Number(row.paidInvoices),
    }));
    return { period, timezone: this.timeZone, ...summarizeActivity(buckets) };
  }

  private async newestOpenAlerts(
    user: AuthUser,
  ): Promise<DashboardSummary['needAttention']['alerts']> {
    const qb = this.alerts
      .createQueryBuilder('a')
      .innerJoin('a.order', 'o')
      .leftJoin('a.subOrder', 'so')
      .select('o.number', 'orderNumber')
      .addSelect('a.kind', 'kind')
      .addSelect('so.number', 'subOrderNumber')
      .where('o.company_id = :companyId', { companyId: user.companyId })
      .andWhere('a.resolved_at IS NULL');
    const rows = await qb
      .andWhere(orderPredicates(qb).active)
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .limit(ATTENTION_ALERTS_LIMIT)
      .getRawMany<{ orderNumber: string; kind: AlertKind; subOrderNumber: string | null }>();
    return rows.map(({ orderNumber, kind, subOrderNumber }) => ({
      orderNumber,
      kind,
      subOrderNumber,
    }));
  }
}
