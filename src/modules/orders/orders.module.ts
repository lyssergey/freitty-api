import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CargoItem } from './entities/cargo-item.entity.js';
import { Operation } from './entities/operation.entity.js';
import { OrderAlert } from './entities/order-alert.entity.js';
import { OrderSupply } from './entities/order-supply.entity.js';
import { Order } from './entities/order.entity.js';
import { SubOrder } from './entities/sub-order.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, SubOrder, CargoItem, OrderAlert, Operation, OrderSupply]),
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
