import type { ActivityRow } from './activity.sql.js';
import type { DashboardActivity } from './dashboard.types.js';

type ActivitySummary = Pick<DashboardActivity, 'buckets' | 'totals' | 'comparison' | 'peak'>;

/** Rounded % change from `previous` to `current`; null when there is no base to compare to. */
export function changePct(
  current: number | undefined,
  previous: number | undefined,
): number | null {
  if (current === undefined || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Totals, comparison and peak of the activity buckets (oldest → newest). The last
 * bucket is still running, so the comparison uses the last complete bucket and
 * the one before it.
 */
export function summarizeActivity(rows: readonly ActivityRow[]): ActivitySummary {
  const buckets = rows.map(({ start, completed, spendCents }) => ({
    start,
    completed,
    spendCents,
  }));
  const completed = buckets.reduce((sum, b) => sum + b.completed, 0);
  const spendCents = buckets.reduce((sum, b) => sum + b.spendCents, 0);
  const paidInvoices = rows.reduce((sum, row) => sum + row.paidInvoices, 0);
  const lastComplete = buckets.at(-2);
  const beforeLast = buckets.at(-3);
  const peak = buckets.reduce<(typeof buckets)[number] | null>(
    (best, b) => (b.spendCents > (best?.spendCents ?? 0) ? b : best),
    null,
  );

  return {
    buckets,
    totals: {
      completed,
      spendCents,
      avgOrderCents: paidInvoices > 0 ? Math.round(spendCents / paidInvoices) : null,
    },
    comparison: {
      completedChangePct: changePct(lastComplete?.completed, beforeLast?.completed),
      spendChangePct: changePct(lastComplete?.spendCents, beforeLast?.spendCents),
    },
    peak: peak ? { start: peak.start, spendCents: peak.spendCents } : null,
  };
}
