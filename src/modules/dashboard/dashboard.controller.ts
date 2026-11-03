import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { OrderListItem } from '../orders/order.types.js';
import { DashboardService } from './dashboard.service.js';
import type { DashboardActivity, DashboardSummary } from './dashboard.types.js';
import { ActivityQuery, RecentOrdersQuery } from './dto/dashboard.query.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser): Promise<DashboardSummary> {
    return this.dashboard.summary(user);
  }

  @Get('recent-orders')
  recentOrders(
    @CurrentUser() user: AuthUser,
    @Query() query: RecentOrdersQuery,
  ): Promise<{ items: OrderListItem[] }> {
    return this.dashboard.recentOrders(user, query.limit);
  }

  @Get('activity')
  activity(
    @CurrentUser() user: AuthUser,
    @Query() query: ActivityQuery,
  ): Promise<DashboardActivity> {
    return this.dashboard.activity(user, query.period);
  }
}
