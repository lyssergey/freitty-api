import { Controller, Get } from '@nestjs/common';
import type { HubRef } from './hub.ref.js';
import { HubsService } from './hubs.service.js';

@Controller('hubs')
export class HubsController {
  constructor(private readonly hubs: HubsService) {}

  @Get()
  list(): Promise<{ items: HubRef[] }> {
    return this.hubs.list();
  }
}
