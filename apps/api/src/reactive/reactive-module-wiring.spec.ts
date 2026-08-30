import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { AppModule } from '../app/app.module';
import { PrismaService } from '../prisma/prisma.service';
import { TRADING_QUEUE } from '../trading/trading.service';
import { EVALUATION_QUEUE } from '../agents/evaluation/evaluation.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../orchestrator/document-processor.service';
import { MarketStreamService } from './market-stream.service';
import { StreamHealthService } from './stream-health.service';
import { FastPathService } from './fast-path.service';
import { MaterialEventService } from './material-event.service';

function mockQueue() {
  return {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };
}

describe('ReactiveModule wiring in AppModule', () => {
  it('resolves the four reactive services through Nest DI', async () => {
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
    expect(moduleRef.get(MaterialEventService)).toBeInstanceOf(MaterialEventService);

    await moduleRef.close();
  });
});
