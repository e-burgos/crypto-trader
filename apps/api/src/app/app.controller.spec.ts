import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import type { HealthService, HealthReport } from './health.service';

function buildResponseDouble() {
  const status = jest.fn();
  return { res: { status } as unknown as Response, status };
}

function buildController(report: HealthReport) {
  const healthService = {
    check: jest.fn().mockResolvedValue(report),
  } as unknown as HealthService;
  return {
    controller: new AppController(new AppService(), healthService),
    healthService,
  };
}

const OK_REPORT: HealthReport = {
  status: 'ok',
  database: 'up',
  redis: 'up',
  checkedAt: '2026-09-01T00:00:00.000Z',
};

describe('AppController', () => {
  describe('GET /health', () => {
    it('answers 200 when every dependency is up', async () => {
      const { controller } = buildController(OK_REPORT);
      const { res, status } = buildResponseDouble();
      await expect(controller.health(res)).resolves.toEqual(OK_REPORT);
      expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('answers 503 when a dependency is down', async () => {
      const degraded: HealthReport = { ...OK_REPORT, status: 'degraded', database: 'down' };
      const { controller } = buildController(degraded);
      const { res, status } = buildResponseDouble();
      await expect(controller.health(res)).resolves.toEqual(degraded);
      expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });

    it('delegates to the health service instead of answering a fixed body', async () => {
      const { controller, healthService } = buildController(OK_REPORT);
      const { res } = buildResponseDouble();
      await controller.health(res);
      expect(healthService.check).toHaveBeenCalledTimes(1);
    });
  });
});
