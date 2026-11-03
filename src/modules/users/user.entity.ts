import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Company } from '../companies/company.entity.js';
import { UserRole } from './user-role.js';

/** A person: a client company's user, or hub staff (floor leads) without a company. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company!: Relation<Company> | null;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 4 })
  initials!: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role!: UserRole;

  /** Avatar background, `#RRGGBB`. */
  @Column({ type: 'varchar', length: 7 })
  avatarColor!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
