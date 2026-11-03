import { describe, expect, it } from 'vitest';
import { changePct, summarizeActivity } from './activity.js';

const row = (start: string, completed: number, spendCents: number, paidInvoices: number) => ({
  start,
  completed,
  spendCents,
  paidInvoices,
});

describe('changePct', () => {
  it('rounds the relative change and has no value without a base', () => {
    expect(changePct(24, 24)).toBe(0);
    expect(changePct(26, 22)).toBe(18);
    expect(changePct(5, 10)).toBe(-50);
    expect(changePct(3, 0)).toBeNull();
    expect(changePct(undefined, 3)).toBeNull();
  });
});

describe('summarizeActivity', () => {
  const rows = [
    row('2026-07-01', 18, 1_200_000, 17),
    row('2026-08-01', 22, 2_000_000, 21),
    row('2026-09-01', 26, 1_500_000, 25),
    row('2026-10-01', 4, 300_000, 3), // current, partial month
  ];

  it('totals the range and averages spend per paid invoice', () => {
    expect(summarizeActivity(rows).totals).toEqual({
      completed: 70,
      spendCents: 5_000_000,
      avgOrderCents: Math.round(5_000_000 / 66),
    });
  });

  it('compares the last complete bucket with the one before it', () => {
    expect(summarizeActivity(rows).comparison).toEqual({
      completedChangePct: 18,
      spendChangePct: -25,
    });
  });

  it('finds the peak spend bucket', () => {
    expect(summarizeActivity(rows).peak).toEqual({ start: '2026-08-01', spendCents: 2_000_000 });
  });

  it('returns buckets without the paid-invoice helper column', () => {
    expect(summarizeActivity(rows).buckets[0]).toEqual({
      start: '2026-07-01',
      completed: 18,
      spendCents: 1_200_000,
    });
  });

  it('copes with an empty history', () => {
    const empty = summarizeActivity([
      row('2026-10-01', 0, 0, 0),
      row('2026-11-01', 0, 0, 0),
      row('2026-12-01', 0, 0, 0),
    ]);
    expect(empty).toMatchObject({
      totals: { completed: 0, spendCents: 0, avgOrderCents: null },
      comparison: { completedChangePct: null, spendChangePct: null },
      peak: null,
    });
  });
});
