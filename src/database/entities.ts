import { Carrier } from '../modules/carriers/carrier.entity.js';
import { Company } from '../modules/companies/company.entity.js';
import { Hub } from '../modules/hubs/hub.entity.js';
import { CargoItem } from '../modules/orders/entities/cargo-item.entity.js';
import { Invoice } from '../modules/orders/entities/invoice.entity.js';
import { Operation } from '../modules/orders/entities/operation.entity.js';
import { OrderAlert } from '../modules/orders/entities/order-alert.entity.js';
import { OrderSupply } from '../modules/orders/entities/order-supply.entity.js';
import { Order } from '../modules/orders/entities/order.entity.js';
import { SubOrder } from '../modules/orders/entities/sub-order.entity.js';
import { SupplyItem } from '../modules/supplies/supply-item.entity.js';
import { User } from '../modules/users/user.entity.js';

/**
 * Single source of truth for the entity set, in foreign-key order (parents first —
 * the seed inserts in this order). Passed as class references, never a glob: glob
 * discovery is unreliable under ESM/NodeNext.
 */
export const ENTITIES = [
  Company,
  User,
  Hub,
  Carrier,
  SupplyItem,
  Order,
  SubOrder,
  CargoItem,
  OrderAlert,
  Operation,
  OrderSupply,
  Invoice,
];
