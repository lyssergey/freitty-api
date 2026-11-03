/** Declared in display order (supplies tables are grouped by it). */
export const SupplyCategory = {
  SECUREMENT: 'securement',
  EDGE_PROTECTION: 'edge_protection',
  WRAP: 'wrap',
  PALLETS: 'pallets',
  LABELING: 'labeling',
} as const;
export type SupplyCategory = (typeof SupplyCategory)[keyof typeof SupplyCategory];

export const SUPPLY_CATEGORY_ORDER: readonly SupplyCategory[] = Object.values(SupplyCategory);
