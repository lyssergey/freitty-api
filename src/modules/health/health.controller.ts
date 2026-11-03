import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator.js';
import { HealthService, type HealthReport } from './health.service.js';

/**
 * `GET /api/health`, and `GET /` (excluded from the `api` prefix) so hitting the
 * bare domain shows the service is alive instead of a 404. Public: no auth, no
 * rate limit.
 */
@Public()
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  root(): Promise<HealthReport> {
    return this.health.check();
  }

  @Get('health')
  check(): Promise<HealthReport> {
    return this.health.check();
  }
}
