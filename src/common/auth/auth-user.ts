import type { Request } from 'express';

/** Who a request acts for. Every cabinet query is scoped by `companyId`. */
export interface AuthUser {
  id: string;
  companyId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
