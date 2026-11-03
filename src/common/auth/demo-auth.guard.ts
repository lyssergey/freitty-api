import {
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { RootConfig } from '../../config/configuration.js';
import { UsersService } from '../../modules/users/users.service.js';
import type { AuthenticatedRequest, AuthUser } from './auth-user.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Authentication is out of scope for this demo: every request acts as one seeded
 * user (`DEMO_USER_EMAIL`). The guard is global, so swapping it for a real one
 * (session / JWT) leaves controllers and services untouched — they only see
 * `req.user = { id, companyId }`.
 */
@Injectable()
export class DemoAuthGuard implements CanActivate {
  private readonly email: string;
  private demoUser: Promise<AuthUser> | null = null;

  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
    config: ConfigService<RootConfig, true>,
  ) {
    this.email = config.get('app', { infer: true }).demoUserEmail;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    context.switchToHttp().getRequest<AuthenticatedRequest>().user = await this.resolveDemoUser();
    return true;
  }

  /** Looked up once per instance and cached; a failed lookup is retried next time. */
  private resolveDemoUser(): Promise<AuthUser> {
    if (!this.demoUser) {
      const lookup = this.lookupDemoUser();
      lookup.catch(() => {
        if (this.demoUser === lookup) this.demoUser = null;
      });
      this.demoUser = lookup;
    }
    return this.demoUser;
  }

  private async lookupDemoUser(): Promise<AuthUser> {
    const user = await this.users.findByEmail(this.email);
    if (!user?.companyId) {
      throw new ServiceUnavailableException(
        `Demo user ${this.email} is not seeded — run "npm run db:seed"`,
      );
    }
    return { id: user.id, companyId: user.companyId };
  }
}
