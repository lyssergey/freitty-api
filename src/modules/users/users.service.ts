import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { User } from './user.entity.js';
import { toUserRef, type UserRef } from './user.ref.js';

export interface MeResponse {
  user: UserRef & { email: string };
  company: { id: string; name: string; balanceCents: number };
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  /** The current user with their company (topbar chip, balance pill). */
  async me(auth: AuthUser): Promise<MeResponse> {
    const user = await this.users.findOne({
      where: { id: auth.id, companyId: auth.companyId },
      relations: { company: true },
    });
    if (!user?.company) throw new NotFoundException('Current user not found');
    return {
      user: { ...toUserRef(user), email: user.email },
      company: {
        id: user.company.id,
        name: user.company.name,
        balanceCents: user.company.balanceCents,
      },
    };
  }
}
