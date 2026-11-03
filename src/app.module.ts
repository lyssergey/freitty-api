import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { DemoAuthGuard } from './common/auth/demo-auth.guard.js';
import { configuration } from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HubsModule } from './modules/hubs/hubs.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [() => configuration()],
      validate: validateEnv,
      // In tests, never read the developer's .env: test/setup-e2e.ts sets the env
      // explicitly, so the e2e run always hits the local test database.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    DatabaseModule,
    UsersModule,
    HubsModule,
    OrdersModule,
    DashboardModule,
    HealthModule,
  ],
  // Every route acts as the demo user unless marked @Public().
  providers: [{ provide: APP_GUARD, useClass: DemoAuthGuard }],
})
export class AppModule {}
