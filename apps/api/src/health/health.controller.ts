import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'api' };
  }

  @Get('ready')
  async ready() {
    if (!(await this.health.ready())) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        checks: { database: 'unavailable' },
      });
    }
    return { status: 'ok', checks: { database: 'ok' } };
  }
}
