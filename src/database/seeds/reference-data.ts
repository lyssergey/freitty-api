import { OperationKind, UnitType } from '../../modules/orders/order.enums.js';
import { SupplyCategory } from '../../modules/supplies/supply-category.js';
import { UserRole } from '../../modules/users/user-role.js';
import type { SeedClock } from './clock.js';
import type { Random } from './prng.js';
import type { HubCode, ReferenceData, UserKey, UserRow } from './seed-types.js';

/** Seed of the deterministic PRNG (the mockup's "today", 17 Apr 2026). */
export const SEED = 20260417;

export const COMPANY = { name: 'R-way Transport', balanceCents: 125_000 } as const;

interface UserSeed {
  key: UserKey;
  role: UserRole;
  avatarColor: string;
  /** Client users belong to the company; hub staff do not. */
  client: boolean;
}

const USERS: readonly UserSeed[] = [
  { key: 'U1', role: UserRole.ADMIN, avatarColor: '#5B21B6', client: true },
  { key: 'U2', role: UserRole.DISPATCHER, avatarColor: '#0EA5E9', client: true },
  { key: 'U3', role: UserRole.DISPATCHER, avatarColor: '#16A34A', client: true },
  { key: 'U4', role: UserRole.DISPATCHER, avatarColor: '#D97706', client: true },
  { key: 'U5', role: UserRole.DRIVER, avatarColor: '#DC2626', client: true },
  { key: 'U6', role: UserRole.FLOOR_LEAD, avatarColor: '#475569', client: false }, // Markham
  { key: 'U7', role: UserRole.FLOOR_LEAD, avatarColor: '#0F766E', client: false }, // Toronto
  { key: 'U8', role: UserRole.DRIVER, avatarColor: '#9333EA', client: true },
];

/** The demo "current user". */
export const DEMO_USER_EMAIL = 'user1@rway-transport.example';

export const HUBS: ReadonlyArray<{
  code: HubCode;
  name: string;
  province: string;
  dockCount: number;
}> = [
  { code: 'MAR', name: 'Markham', province: 'ON', dockCount: 24 },
  { code: 'TOR', name: 'Toronto', province: 'ON', dockCount: 32 },
];

/** Floor lead assigned to orders of each hub. */
export const HUB_FLOOR_LEAD: Record<HubCode, UserKey> = { MAR: 'U6', TOR: 'U7' };

export const HUB_CITY: Record<HubCode, string> = { MAR: 'Markham, ON', TOR: 'Toronto, ON' };

export const CARRIERS: ReadonlyArray<{ name: string; phone: string }> = [
  { name: 'R-way Transport Inc.', phone: '+1 647 555 0199' },
  { name: 'Schneider', phone: '+1 800 555 0142' },
  { name: 'TForce', phone: '+1 905 555 0177' },
  { name: 'Day & Ross', phone: '+1 506 555 0123' },
  { name: 'Purolator Freight', phone: '+1 888 555 0110' },
  { name: 'Manitoulin Transport', phone: '+1 705 555 0188' },
];

/** "FOE catalog — 16 SKUs", platform prices in cents. */
export const SUPPLY_CATALOG: ReadonlyArray<{
  sku: string;
  name: string;
  category: SupplyCategory;
  unitPriceCents: number;
}> = [
  {
    sku: 'SEC-STR-12',
    name: 'Straps 12',
    category: SupplyCategory.SECUREMENT,
    unitPriceCents: 650,
  },
  {
    sku: 'SEC-STR-24',
    name: 'Straps 24',
    category: SupplyCategory.SECUREMENT,
    unitPriceCents: 1150,
  },
  {
    sku: 'SEC-RAT-2',
    name: 'Ratchet strap 2"',
    category: SupplyCategory.SECUREMENT,
    unitPriceCents: 1490,
  },
  { sku: 'SEC-LBAR', name: 'Load bar', category: SupplyCategory.SECUREMENT, unitPriceCents: 3200 },
  { sku: 'SEC-DUN', name: 'Dunnage bag', category: SupplyCategory.SECUREMENT, unitPriceCents: 890 },
  {
    sku: 'EDG-CRN-50',
    name: 'Corners 50',
    category: SupplyCategory.EDGE_PROTECTION,
    unitPriceCents: 125,
  },
  {
    sku: 'EDG-CRN-100',
    name: 'Corners 100',
    category: SupplyCategory.EDGE_PROTECTION,
    unitPriceCents: 210,
  },
  {
    sku: 'EDG-BRD-36',
    name: 'Edge board 36"',
    category: SupplyCategory.EDGE_PROTECTION,
    unitPriceCents: 180,
  },
  {
    sku: 'WRP-SHR-80',
    name: 'Shrink wrap 80g',
    category: SupplyCategory.WRAP,
    unitPriceCents: 1800,
  },
  {
    sku: 'WRP-SHR-120',
    name: 'Shrink wrap 120g',
    category: SupplyCategory.WRAP,
    unitPriceCents: 2400,
  },
  {
    sku: 'WRP-STR-18',
    name: 'Stretch film 18"',
    category: SupplyCategory.WRAP,
    unitPriceCents: 2100,
  },
  {
    sku: 'PAL-STD',
    name: 'Pallet Std 48×40',
    category: SupplyCategory.PALLETS,
    unitPriceCents: 1600,
  },
  {
    sku: 'PAL-XL',
    name: 'Pallet XL 48×48',
    category: SupplyCategory.PALLETS,
    unitPriceCents: 2200,
  },
  { sku: 'PAL-SLP', name: 'Slip sheet', category: SupplyCategory.PALLETS, unitPriceCents: 350 },
  {
    sku: 'LBL-A6',
    name: 'Labels A6 (100)',
    category: SupplyCategory.LABELING,
    unitPriceCents: 900,
  },
  {
    sku: 'LBL-FRG',
    name: 'Fragile labels (50)',
    category: SupplyCategory.LABELING,
    unitPriceCents: 750,
  },
];

/** Warehouse tariff in cents per unit. Restack and disposal are not billed. */
export function operationTariff(
  kind: OperationKind,
  unitType: UnitType,
): { billable: boolean; rateCents: number } {
  switch (kind) {
    case OperationKind.UNLOADING:
    case OperationKind.LOADING:
      return { billable: true, rateCents: unitType === UnitType.XL ? 2200 : 1800 };
    case OperationKind.TRANSLOAD:
      return { billable: true, rateCents: 1400 };
    case OperationKind.CONSOLIDATION:
    case OperationKind.DECONSOLIDATION:
      return { billable: true, rateCents: 900 };
    case OperationKind.WRAPPING:
      return { billable: true, rateCents: 600 };
    case OperationKind.RESTACK:
    case OperationKind.DISPOSAL:
      return { billable: false, rateCents: 0 };
  }
}

export function buildReferenceData(ids: Random, clock: SeedClock): ReferenceData {
  const company = {
    id: ids.uuid(),
    name: COMPANY.name,
    balanceCents: COMPANY.balanceCents,
    createdAt: clock.day(-720, '09:00'),
  };

  const users = {} as Record<UserKey, UserRow>;
  USERS.forEach((seed, index) => {
    const n = index + 1;
    users[seed.key] = {
      id: ids.uuid(),
      companyId: seed.client ? company.id : null,
      name: `User ${n}`,
      initials: `U${n}`,
      email: seed.client ? `user${n}@rway-transport.example` : `user${n}@freitty.example`,
      role: seed.role,
      avatarColor: seed.avatarColor,
      createdAt: clock.day(-700 + index, '10:00'),
    };
  });

  const hubs = {} as ReferenceData['hubs'];
  for (const hub of HUBS) {
    hubs[hub.code] = { id: ids.uuid(), ...hub, timezone: 'America/Toronto' };
  }

  const carriers = new Map(
    CARRIERS.map((carrier) => [carrier.name, { id: ids.uuid(), ...carrier }] as const),
  );
  const supplyItems = new Map(
    SUPPLY_CATALOG.map((item) => [item.sku, { id: ids.uuid(), ...item }] as const),
  );

  return { company, users, hubs, carriers, supplyItems };
}
