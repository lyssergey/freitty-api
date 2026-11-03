import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { UsersService, type MeResponse } from './users.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.users.me(user);
  }
}
