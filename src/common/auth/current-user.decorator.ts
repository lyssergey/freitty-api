import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './auth-user.js';

/** Injects the request's `AuthUser` (set by `DemoAuthGuard`), or one of its fields. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return field ? req.user?.[field] : req.user;
  },
);
