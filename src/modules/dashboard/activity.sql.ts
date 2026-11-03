/** One row per bucket, as returned by `activitySql`. */
export interface ActivityRow {
  start: string;
  completed: number;
  spendCents: number;
  paidInvoices: number;
}

/**
 * Calendar-aligned activity buckets in a single statement: `generate_series` over
 * the local bucket starts (`date_trunc` in the business time zone — weeks start on
 * Monday, quarters step by '3 months' since there is no '1 quarter' interval),
 * LEFT JOINed with orders completed (by `closed_at`) and invoices paid (by
 * `paid_at`) per bucket, so empty buckets still come back as zeros.
 *
 * Parameters: $1 company id · $2 time zone · $3 date_trunc unit · $4 step
 * interval · $5 number of buckets · $6 now.
 */
export function activitySql(tables: { orders: string; invoices: string }): string {
  return `
    WITH buckets AS (
      SELECT generate_series(
               date_trunc($3::text, $6::timestamptz AT TIME ZONE $2::text) - ($5::int - 1) * $4::interval,
               date_trunc($3::text, $6::timestamptz AT TIME ZONE $2::text),
               $4::interval
             ) AS bucket_start
    ),
    bounds AS (
      SELECT min(bucket_start) AT TIME ZONE $2::text AS since FROM buckets
    ),
    completed AS (
      SELECT date_trunc($3::text, o.closed_at AT TIME ZONE $2::text) AS bucket_start,
             count(*)::int AS completed
        FROM ${tables.orders} o
        CROSS JOIN bounds
       WHERE o.company_id = $1 AND o.status = 'closed' AND o.closed_at >= bounds.since
       GROUP BY 1
    ),
    spend AS (
      SELECT date_trunc($3::text, i.paid_at AT TIME ZONE $2::text) AS bucket_start,
             sum(i.amount_cents)::bigint AS spend_cents,
             count(*)::int AS paid_invoices
        FROM ${tables.invoices} i
        JOIN ${tables.orders} o ON o.id = i.order_id
        CROSS JOIN bounds
       WHERE o.company_id = $1 AND i.paid_at >= bounds.since
       GROUP BY 1
    )
    SELECT to_char(b.bucket_start, 'YYYY-MM-DD') AS "start",
           coalesce(c.completed, 0) AS "completed",
           coalesce(s.spend_cents, 0) AS "spendCents",
           coalesce(s.paid_invoices, 0) AS "paidInvoices"
      FROM buckets b
      LEFT JOIN completed c USING (bucket_start)
      LEFT JOIN spend s USING (bucket_start)
     ORDER BY b.bucket_start`;
}
