import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hub } from './hub.entity.js';
import { HubsController } from './hubs.controller.js';
import { HubsService } from './hubs.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Hub])],
  providers: [HubsService],
  controllers: [HubsController],
})
export class HubsModule {}
