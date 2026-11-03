import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderAlert } from '../orders/entities/order-alert.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { OrdersModule } from '../orders/orders.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderAlert]), OrdersModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
