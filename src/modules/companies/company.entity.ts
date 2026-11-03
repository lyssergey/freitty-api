import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A client company — the tenant every cabinet query is scoped to. Money is in cents. */
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** Prepaid platform balance ("Top up"). */
  @Column({ type: 'int', default: 0 })
  balanceCents!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
