import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { AppModule } from '../app/app.module';
import { PrismaService } from '../prisma/prisma.service';
import { TRADING_QUEUE } from '../trading/trading.service';
import { EVALUATION_QUEUE } from '../agents/evaluation/evaluation.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../orchestrator/document-processor.service';
import { MarketStreamService } from './market-stream.service';
import { StreamHealthService } from './stream-health.service';
import { StreamHealthController } from './stream-health.controller';
import { FastPathService } from './fast-path.service';
import { EntryFillWatchService } from './entry-fill-watch.service';
import { MaterialEventService } from './material-event.service';
import { EntryOrderService } from '../trading/entry-order.service';

function mockQueue() {
  return {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };
}

describe('ReactiveModule wiring in AppModule', () => {
  it('resolves the reactive services and the stream-health controller through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(getQueueToken(TRADING_QUEUE))
      .useValue(mockQueue())
      .overrideProvider(getQueueToken(EVALUATION_QUEUE))
      .useValue(mockQueue())
      .overrideProvider(getQueueToken(DOCUMENT_PROCESSING_QUEUE))
      .useValue(mockQueue())
      .compile();

    expect(moduleRef.get(MarketStreamService)).toBeInstanceOf(MarketStreamService);
    expect(moduleRef.get(StreamHealthService)).toBeInstanceOf(StreamHealthService);
    expect(moduleRef.get(FastPathService)).toBeInstanceOf(FastPathService);
    expect(moduleRef.get(EntryFillWatchService)).toBeInstanceOf(EntryFillWatchService);
    expect(moduleRef.get(EntryOrderService)).toBeInstanceOf(EntryOrderService);
    expect(moduleRef.get(MaterialEventService)).toBeInstanceOf(MaterialEventService);

    const controller = moduleRef.get(StreamHealthController);
    expect(controller).toBeInstanceOf(StreamHealthController);
    expect(
      (controller as unknown as { streamHealth: StreamHealthService })
        .streamHealth,
    ).toBe(moduleRef.get(StreamHealthService));

    await moduleRef.close();
  });
});
