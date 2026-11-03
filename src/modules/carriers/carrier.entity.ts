import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A trucking company an order can be handed to. */
@Entity('carriers')
export class Carrier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;
}
