import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A warehouse hub (cross-dock / consolidation site). */
@Entity('hubs')
export class Hub {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Short code used in URLs and filters, e.g. `MAR`. */
  @Column({ type: 'varchar', length: 8, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  /** Two-letter province / state, e.g. `ON`. */
  @Column({ type: 'varchar', length: 2 })
  province!: string;

  @Column({ type: 'varchar', length: 64, default: 'America/Toronto' })
  timezone!: string;

  @Column({ type: 'smallint' })
  dockCount!: number;
}
