import type { Hub } from './hub.entity.js';

export interface HubRef {
  id: string;
  code: string;
  name: string;
  province: string;
}

export function toHubRef(hub: Hub): HubRef {
  return { id: hub.id, code: hub.code, name: hub.name, province: hub.province };
}
