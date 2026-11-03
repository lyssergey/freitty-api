import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from './hub.entity.js';
import { toHubRef, type HubRef } from './hub.ref.js';

@Injectable()
export class HubsService {
  constructor(@InjectRepository(Hub) private readonly hubs: Repository<Hub>) {}

  /** Platform hubs (shared reference data, not company-owned), by name. */
  async list(): Promise<{ items: HubRef[] }> {
    const hubs = await this.hubs.find({ order: { name: 'ASC' } });
    return { items: hubs.map(toHubRef) };
  }
}
