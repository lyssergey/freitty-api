import type { ActivityPeriod } from '../../common/time/periods.js';
import type { AlertKind } from '../orders/order.enums.js';

export interface DashboardSummary {
  activeOrders: {
    count: number;
    /** Active orders created in the last 7 days. */
    createdThisWeek: number;
  };
  /** Orders closed in the rolling last 30 days vs the 30 days before. */
  completed: { last30d: number; previous30d: number };
  needAttention: {
    /** awaitingAction + alertOrders */
    total: number;
    /** Active, waiting on a client-owned action, no open alert. */
    awaitingAction: number;
    /** Active with at least one open alert. */
    alertOrders: number;
    /** Newest open alerts on active orders (at most 5). */
    alerts: Array<{ orderNumber: string; kind: AlertKind; subOrderNumber: string | null }>;
  };
}

export interface ActivityBucket {
  /** Local calendar date the bucket starts on, `YYYY-MM-DD`. */
  start: string;
  completed: number;
  spendCents: number;
}

export interface DashboardActivity {
  period: ActivityPeriod;
  timezone: string;
  /** Oldest → newest; the last one is the current, still running bucket. */
  buckets: ActivityBucket[];
  totals: {
    completed: number;
    spendCents: number;
    /** Spend per paid invoice in the range; null when nothing was paid. */
    avgOrderCents: number | null;
  };
  /** Last complete bucket vs the one before it (rounded %); null when the earlier one is 0. */
  comparison: { completedChangePct: number | null; spendChangePct: number | null };
  /** Bucket with the highest spend; null when nothing was spent. */
  peak: { start: string; spendCents: number } | null;
}
