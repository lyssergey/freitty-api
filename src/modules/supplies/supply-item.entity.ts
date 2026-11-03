import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SupplyCategory } from './supply-category.js';

/** Catalog of stock items sold on orders ("FOE catalog"), at platform prices. */
@Entity('supply_items')
export class SupplyItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  sku!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'enum', enum: SupplyCategory, enumName: 'supply_category' })
  category!: SupplyCategory;

  @Column({ type: 'int' })
  unitPriceCents!: number;
}
