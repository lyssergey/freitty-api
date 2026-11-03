import { seedClock } from './clock.js';
import { featuredOrders } from './featured-orders.js';
import { historicalOrders } from './history.js';
import { materializeOrder } from './order-builder.js';
import { mulberry32, Random } from './prng.js';
import { buildReferenceData, SEED } from './reference-data.js';
import type { Dataset, InvoiceRow, OrderDraft } from './seed-types.js';

/** Ids use their own PRNG stream, so adding a row never reshuffles the generated data. */
const ID_STREAM_SEED = SEED ^ 0x5eed_1d5;

/** The mockup shows FR001672 paid with invoice #001812; all other numbers follow from it. */
const INVOICE_ANCHOR = { order: 'FR001672', number: 1812 } as const;

/**
 * Builds the whole demo database in memory — pure and deterministic: no I/O, all
 * randomness from seeded PRNGs, every date relative to `now` (wall times in
 * `timeZone`). Two calls with the same arguments return deep-equal datasets.
 */
export function buildDataset(now: Date, timeZone = 'America/Toronto'): Dataset {
  const clock = seedClock(now, timeZone);
  const rng = new Random(mulberry32(SEED));
  const ids = new Random(mulberry32(ID_STREAM_SEED));

  const ref = buildReferenceData(ids, clock);
  const specs = [...featuredOrders(clock), ...historicalOrders(rng, clock)];
  const drafts = specs.map((spec) => materializeOrder(spec, ref, ids));

  return {
    companies: [ref.company],
    users: Object.values(ref.users),
    hubs: Object.values(ref.hubs),
    carriers: [...ref.carriers.values()],
    supplyItems: [...ref.supplyItems.values()],
    orders: drafts.map((draft) => draft.order),
    subOrders: drafts.flatMap((draft) => draft.subOrders),
    cargoItems: drafts.flatMap((draft) => draft.cargoItems),
    alerts: drafts.flatMap((draft) => draft.alerts),
    operations: drafts.flatMap((draft) => draft.operations),
    orderSupplies: drafts.flatMap((draft) => draft.orderSupplies),
    invoices: numberInvoices(drafts),
  };
}

/** Sequential 6-digit invoice numbers by issue time, across all invoices. */
function numberInvoices(drafts: OrderDraft[]): InvoiceRow[] {
  const issued = drafts
    .flatMap(({ order, invoice }) => (invoice ? [{ orderNumber: order.number, invoice }] : []))
    .sort(
      (a, b) =>
        a.invoice.issuedAt.getTime() - b.invoice.issuedAt.getTime() ||
        a.orderNumber.localeCompare(b.orderNumber),
    );
  const anchorIndex = issued.findIndex((entry) => entry.orderNumber === INVOICE_ANCHOR.order);
  if (anchorIndex < 0) throw new Error(`${INVOICE_ANCHOR.order} must have an invoice`);
  const first = INVOICE_ANCHOR.number - anchorIndex;
  return issued.map(({ invoice }, index) => ({
    ...invoice,
    number: String(first + index).padStart(6, '0'),
  }));
}
