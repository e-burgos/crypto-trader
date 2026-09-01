import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import { HealthService } from './health.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly healthService: HealthService,
  ) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const report = await this.healthService.check();
    // 503 when a dependency is down: an orchestrator that only reads the status
    // code must not keep routing traffic to an instance whose database is gone.
    res.status(
      report.status === 'ok'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return report;
  }
}
