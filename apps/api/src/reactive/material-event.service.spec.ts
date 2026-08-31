import type { MarketCandleTick, MarketTick } from '@crypto-trader/shared';
import { MaterialEventService } from './material-event.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';

const detectMaterialEventMock = jest.fn();

jest.mock('@crypto-trader/analysis', () => ({
  ...jest.requireActual('@crypto-trader/analysis'),
  detectMaterialEvent: (...args: unknown[]) => detectMaterialEventMock(...args),
}));

function noEventResult(state: unknown = {}) {
  return { event: null, detail: 'NO_MATERIAL_CHANGE', state };
}

function eventResult(event: string, state: unknown = {}) {
  return { event, detail: `${event} detected`, state };
}

const baseConfig = {
  id: 'config-1',
  userId: 'user-1',
  asset: 'BTC',
  pair: 'USDT',
  isRunning: true,
  reactiveLoopEnabled: true,
  gatePriceChangePct: 0.005,
};

const tick: MarketTick = { symbol: 'BTCUSDT', price: 30_100, timestamp: 1_700_000_000_000 };

const decisionRow = {
  metadata: { gate: { snapshot: { close: 30_000, takenAt: 1_699_999_000_000 } } },
  indicators: {
    supportResistance: { support: [29_500], resistance: [30_500] },
    volume: { average: 100 },
  },
};

function buildPrisma(overrides: { configs?: any[]; decision?: any } = {}) {
  return {
    tradingConfig: {
      findMany: jest.fn().mockResolvedValue(overrides.configs ?? [baseConfig]),
    },
    agentDecision: {
      findFirst: jest.fn().mockResolvedValue(
        overrides.decision === undefined ? decisionRow : overrides.decision,
      ),
    },
  };
}

function buildMarketStream(overrides: { warmup?: boolean } = {}) {
  return {
    on: jest.fn(),
    off: jest.fn(),
    isWarmupComplete: jest.fn().mockReturnValue(overrides.warmup ?? true),
  };
}

function buildStreamHealth(overrides: { state?: string } = {}) {
  return {
    resolve: jest.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      state: overrides.state ?? 'HEALTHY',
      reason: null,
      record: null,
    }),
  };
}

function createFakeCoordination(
  overrides: { window?: { windowEndMs: number } | null; tokenOk?: boolean } = {},
): ReactiveCoordinationPort {
  return {
    tryAcquire: jest.fn(async () => true),
    renew: jest.fn(async () => true),
    release: jest.fn(async () => undefined),
    tryConsumeToken: jest.fn(async () => overrides.tokenOk ?? true),
    setJson: jest.fn(async () => undefined),
    getJson: jest.fn(async () => (overrides.window === undefined ? { windowEndMs: Date.now() + 60_000 } : overrides.window)),
    isHealthy: jest.fn(() => true),
  } as unknown as ReactiveCoordinationPort;
}

function buildQueue(overrides: { delayed?: any[] } = {}) {
  return {
    getDelayed: jest.fn().mockResolvedValue(
      overrides.delayed ?? [{ data: { configId: 'config-1' }, promote: jest.fn().mockResolvedValue(undefined) }],
    ),
    add: jest.fn().mockResolvedValue(undefined),
  };
}

function buildGateway() {
  return { emitToAll: jest.fn(), emitToUser: jest.fn() };
}

function buildService(
  params: {
    prisma?: any;
    marketStream?: any;
    streamHealth?: any;
    coordination?: ReactiveCoordinationPort;
    tradingQueue?: any;
    gateway?: any;
  } = {},
) {
  const prisma = params.prisma ?? buildPrisma();
  const marketStream = params.marketStream ?? buildMarketStream();
  const streamHealth = params.streamHealth ?? buildStreamHealth();
  const coordination = params.coordination ?? createFakeCoordination();
  const tradingQueue = params.tradingQueue ?? buildQueue();
  const gateway = params.gateway ?? buildGateway();

  const service = new MaterialEventService(
    prisma as any,
    marketStream as any,
    streamHealth as any,
    coordination,
    tradingQueue as any,
    DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    gateway as any,
  );

  return { service, prisma, marketStream, streamHealth, coordination, tradingQueue, gateway };
}

describe('MaterialEventService', () => {
  beforeEach(() => {
    detectMaterialEventMock.mockReset();
    detectMaterialEventMock.mockReturnValue(noEventResult());
  });

  it('se suscribe a tick y candle al iniciar, y se desuscribe al apagar', () => {
    const { service, marketStream } = buildService();
    service.onModuleInit();
    expect(marketStream.on).toHaveBeenCalledWith('tick', expect.any(Function));
    expect(marketStream.on).toHaveBeenCalledWith('candle', expect.any(Function));
    service.onApplicationShutdown();
    expect(marketStream.off).toHaveBeenCalledWith('tick', expect.any(Function));
    expect(marketStream.off).toHaveBeenCalledWith('candle', expect.any(Function));
  });

  it('descarta el tick si el warmup del símbolo no terminó', async () => {
    const { service, prisma } = buildService({ marketStream: buildMarketStream({ warmup: false }) });
    await service.handleTick(tick);
    expect(prisma.tradingConfig.findMany).not.toHaveBeenCalled();
    expect(detectMaterialEventMock).not.toHaveBeenCalled();
  });

  it('no evalúa configs de otro símbolo', async () => {
    const { service, prisma } = buildService({
      prisma: buildPrisma({ configs: [{ ...baseConfig, asset: 'ETH' }] }),
    });
    await service.handleTick(tick);
    expect(prisma.agentDecision.findFirst).not.toHaveBeenCalled();
    expect(detectMaterialEventMock).not.toHaveBeenCalled();
  });

  it('compone la referencia desde la última AgentDecision y la pasa al detector puro', async () => {
    const { service } = buildService();
    await service.handleTick(tick);
    expect(detectMaterialEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        now: tick.timestamp,
        tick: { price: tick.price, timestamp: tick.timestamp },
        candle: null,
        reference: {
          close: 30_000,
          takenAt: 1_699_999_000_000,
          supportResistance: { support: [29_500], resistance: [30_500] },
          volumeAverage: 100,
        },
        thresholds: expect.objectContaining({ priceChangePct: 0.005 }),
      }),
    );
  });

  it('reference es null si metadata.gate.snapshot no es válido (fail-closed)', async () => {
    const { service } = buildService({
      prisma: buildPrisma({ decision: { metadata: {}, indicators: decisionRow.indicators } }),
    });
    await service.handleTick(tick);
    expect(detectMaterialEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ reference: null }),
    );
  });

  it('reference es null si indicators no trae supportResistance/volume.average válidos', async () => {
    const { service } = buildService({
      prisma: buildPrisma({ decision: { metadata: decisionRow.metadata, indicators: {} } }),
    });
    await service.handleTick(tick);
    expect(detectMaterialEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ reference: null }),
    );
  });

  it('usa la última candle conocida del símbolo, no la de otro símbolo', async () => {
    const { service } = buildService();
    const candle: MarketCandleTick = {
      symbol: 'BTCUSDT',
      interval: '1h',
      openTime: 1,
      closeTime: 2,
      close: 3,
      volume: 500,
      isClosed: false,
    };
    service.onModuleInit();
    const marketStream = (service as any).marketStream;
    const registeredCandleListener = marketStream.on.mock.calls.find(
      ([event]: [string]) => event === 'candle',
    )[1];
    registeredCandleListener(candle);

    await service.handleTick(tick);

    expect(detectMaterialEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        candle: { volume: 500, openTime: 1, closeTime: 2 },
      }),
    );
  });

  it('sin evento, no toca la coordinación ni la cola', async () => {
    const { service, coordination, tradingQueue } = buildService();
    await service.handleTick(tick);
    expect(coordination.getJson).not.toHaveBeenCalled();
    expect(tradingQueue.getDelayed).not.toHaveBeenCalled();
  });

  describe('secuencia de adelanto (D2)', () => {
    beforeEach(() => {
      detectMaterialEventMock.mockReturnValue(eventResult('PRICE_MOVED'));
    });

    it('adelanta el ciclo: consume token, promueve el job delayed y emite el evento', async () => {
      const { service, coordination, tradingQueue, gateway } = buildService();
      await service.handleTick(tick);

      expect(coordination.getJson).toHaveBeenCalledWith('rx:v1:window:config-1');
      expect(coordination.tryConsumeToken).toHaveBeenCalledWith(
        expect.stringMatching(/^rx:v1:advance:config-1:\d+$/),
        expect.any(Number),
      );
      const delayed = await tradingQueue.getDelayed();
      expect(delayed[0].promote).toHaveBeenCalled();
      expect(gateway.emitToUser).toHaveBeenCalledWith('user-1', 'agent:cycle-advanced', {
        configId: 'config-1',
        symbol: 'BTCUSDT',
        eventType: 'PRICE_MOVED',
        advancedByMs: expect.any(Number),
      });
      expect(gateway.emitToAll).not.toHaveBeenCalled();
    });

    it('aislamiento multiusuario: cada dueno recibe solo el adelanto de su propia config (FIX-e-burgos-005-006)', async () => {
      const otherConfig = { ...baseConfig, id: 'config-2', userId: 'user-2' };
      const { service, gateway } = buildService({
        prisma: buildPrisma({ configs: [baseConfig, otherConfig] }),
        tradingQueue: buildQueue({
          delayed: [
            { data: { configId: 'config-1' }, promote: jest.fn().mockResolvedValue(undefined) },
            { data: { configId: 'config-2' }, promote: jest.fn().mockResolvedValue(undefined) },
          ],
        }),
      });

      await service.handleTick(tick);

      expect(gateway.emitToAll).not.toHaveBeenCalled();
      expect(gateway.emitToUser).toHaveBeenCalledTimes(2);
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'agent:cycle-advanced',
        expect.objectContaining({ configId: 'config-1' }),
      );
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'user-2',
        'agent:cycle-advanced',
        expect.objectContaining({ configId: 'config-2' }),
      );
      for (const [userId, , payload] of gateway.emitToUser.mock.calls) {
        expect((payload as { configId: string }).configId).toBe(
          userId === 'user-1' ? 'config-1' : 'config-2',
        );
      }
    });

    it('config con reactiveLoopEnabled=false no adelanta nada', async () => {
      const { service, coordination } = buildService({
        prisma: buildPrisma({ configs: [{ ...baseConfig, reactiveLoopEnabled: false }] }),
      });
      await service.handleTick(tick);
      expect(coordination.getJson).not.toHaveBeenCalled();
    });

    it('stream no HEALTHY: sale sin tocar la ventana (RN-28)', async () => {
      const { service, coordination } = buildService({
        streamHealth: buildStreamHealth({ state: 'DEGRADED' }),
      });
      await service.handleTick(tick);
      expect(coordination.getJson).not.toHaveBeenCalled();
    });

    it('sin ventana registrada (Redis recién levantado): sale fail-closed sin adelanto', async () => {
      const { service, coordination, tradingQueue } = buildService({
        coordination: createFakeCoordination({ window: null }),
      });
      await service.handleTick(tick);
      expect(coordination.tryConsumeToken).not.toHaveBeenCalled();
      expect(tradingQueue.getDelayed).not.toHaveBeenCalled();
    });

    it('ventana ya vencida (remaining <= 0): sale, el temporizador dispara solo', async () => {
      const { service, coordination } = buildService({
        coordination: createFakeCoordination({ window: { windowEndMs: Date.now() - 1_000 } }),
      });
      await service.handleTick(tick);
      expect(coordination.tryConsumeToken).not.toHaveBeenCalled();
    });

    it('token ya consumido (evento repetido o adelanto ya gastado): no promueve nada', async () => {
      const { service, tradingQueue } = buildService({
        coordination: createFakeCoordination({ tokenOk: false }),
      });
      await service.handleTick(tick);
      expect(tradingQueue.getDelayed).not.toHaveBeenCalled();
    });

    it('sin job delayed para el configId (ya activo/removido): no promueve ni emite', async () => {
      const { service, gateway } = buildService({
        tradingQueue: buildQueue({ delayed: [{ data: { configId: 'otro-config' }, promote: jest.fn() }] }),
      });
      await service.handleTick(tick);
      expect(gateway.emitToUser).not.toHaveBeenCalled();
    });

    it('promote() ya disparado o ya promovido: la excepción se traga y aun así se observa el adelanto', async () => {
      const rejectingJob = {
        data: { configId: 'config-1' },
        promote: jest.fn().mockRejectedValue(new Error('job already promoted')),
      };
      const { service, gateway } = buildService({
        tradingQueue: buildQueue({ delayed: [rejectingJob] }),
      });
      await expect(service.handleTick(tick)).resolves.toBeUndefined();
      expect(rejectingJob.promote).toHaveBeenCalled();
      expect(gateway.emitToUser).toHaveBeenCalled();
    });

    it('el mismo evento llegando dos veces solo adelanta una vez (token SET NX)', async () => {
      let tokenConsumed = false;
      const coordination: ReactiveCoordinationPort = {
        tryAcquire: jest.fn(async () => true),
        renew: jest.fn(async () => true),
        release: jest.fn(async () => undefined),
        tryConsumeToken: jest.fn(async () => {
          if (tokenConsumed) return false;
          tokenConsumed = true;
          return true;
        }),
        setJson: jest.fn(async () => undefined),
        getJson: jest.fn(async () => ({ windowEndMs: Date.now() + 60_000 })),
        isHealthy: jest.fn(() => true),
      } as unknown as ReactiveCoordinationPort;

      const job = { data: { configId: 'config-1' }, promote: jest.fn().mockResolvedValue(undefined) };
      const { service } = buildService({
        coordination,
        tradingQueue: buildQueue({ delayed: [job] }),
      });

      await service.handleTick(tick);
      await service.handleTick(tick);

      expect(job.promote).toHaveBeenCalledTimes(1);
    });

    describe('regresión: un evento adelanta el único ciclo de la ventana, nunca agrega ni pospone', () => {
      const windowStart = 1_700_000_000_000;
      const windowEndMs = windowStart + 60_000;

      beforeEach(() => {
        jest.useFakeTimers({ now: windowStart });
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      function buildTokenGatedCoordination(): ReactiveCoordinationPort {
        const consumedKeys = new Set<string>();
        return {
          tryAcquire: jest.fn(async () => true),
          renew: jest.fn(async () => true),
          release: jest.fn(async () => undefined),
          tryConsumeToken: jest.fn(async (key: string) => {
            if (consumedKeys.has(key)) return false;
            consumedKeys.add(key);
            return true;
          }),
          setJson: jest.fn(async () => undefined),
          getJson: jest.fn(async () => ({ windowEndMs })),
          isHealthy: jest.fn(() => true),
        } as unknown as ReactiveCoordinationPort;
      }

      it('un segundo evento material dentro de la misma ventana NO agrega un segundo ciclo: promote() se llama exactamente una vez', async () => {
        const job = { data: { configId: 'config-1' }, promote: jest.fn().mockResolvedValue(undefined) };
        const tradingQueue = buildQueue({ delayed: [job] });
        const { service, gateway } = buildService({
          coordination: buildTokenGatedCoordination(),
          tradingQueue,
        });

        detectMaterialEventMock.mockReturnValueOnce(eventResult('PRICE_MOVED'));
        await service.handleTick(tick);

        detectMaterialEventMock.mockReturnValueOnce(eventResult('VOLUME_SPIKE'));
        await service.handleTick({ ...tick, timestamp: tick.timestamp + 1_000 });

        expect(job.promote).toHaveBeenCalledTimes(1);
        expect(tradingQueue.add).not.toHaveBeenCalled();
        expect(
          gateway.emitToUser.mock.calls.filter(([, event]: [string, string]) => event === 'agent:cycle-advanced'),
        ).toHaveLength(1);
      });

      it('un evento material NO pospone la ventana vigente: nunca escribe rx:v1:window ni extiende su plazo', async () => {
        const coordination = buildTokenGatedCoordination();
        const { service, gateway } = buildService({ coordination });

        detectMaterialEventMock.mockReturnValueOnce(eventResult('PRICE_MOVED'));
        await service.handleTick(tick);

        expect(coordination.setJson).not.toHaveBeenCalled();
        expect(gateway.emitToUser).toHaveBeenCalledWith(
          'user-1',
          'agent:cycle-advanced',
          expect.objectContaining({ advancedByMs: windowEndMs - windowStart }),
        );
      });
    });
  });

  describe('guarda de salud del stream (RN-26 a RN-29): solo HEALTHY habilita el disparo por evento', () => {
    beforeEach(() => {
      detectMaterialEventMock.mockReturnValue(eventResult('PRICE_MOVED'));
    });

    it('salud UNKNOWN (sin registro) suspende el disparo igual que DEGRADED: no toca ventana, token, cola ni emite', async () => {
      const { service, coordination, tradingQueue, gateway } = buildService({
        streamHealth: buildStreamHealth({ state: 'UNKNOWN' }),
      });
      await service.handleTick(tick);

      expect(coordination.getJson).not.toHaveBeenCalled();
      expect(coordination.tryConsumeToken).not.toHaveBeenCalled();
      expect(tradingQueue.getDelayed).not.toHaveBeenCalled();
      expect(gateway.emitToUser).not.toHaveBeenCalled();
    });

    it('con el stream degradado no se escribe ni se lee nada del bot: el temporizador y el REST del ciclo quedan intactos', async () => {
      const { service, prisma, coordination } = buildService({
        streamHealth: buildStreamHealth({ state: 'DEGRADED' }),
      });
      await service.handleTick(tick);

      expect(prisma.tradingConfig.findMany).toHaveBeenCalled();
      expect(coordination.setJson).not.toHaveBeenCalled();
      expect(coordination.getJson).not.toHaveBeenCalled();
    });

    it('la suspensión no queda pegada: al volver el stream a HEALTHY el disparo por evento se reactiva sin intervención manual', async () => {
      const streamHealth = {
        resolve: jest
          .fn()
          .mockResolvedValueOnce({ symbol: 'BTCUSDT', state: 'DEGRADED', reason: 'TICK_STALE', record: null })
          .mockResolvedValueOnce({ symbol: 'BTCUSDT', state: 'HEALTHY', reason: null, record: null }),
      };
      const { service, coordination, gateway } = buildService({ streamHealth });

      await service.handleTick(tick);
      expect(coordination.getJson).not.toHaveBeenCalled();
      expect(gateway.emitToUser).not.toHaveBeenCalled();

      await service.handleTick({ ...tick, timestamp: tick.timestamp + 1_000 });
      expect(coordination.getJson).toHaveBeenCalled();
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'agent:cycle-advanced',
        expect.objectContaining({ configId: 'config-1' }),
      );
    });
  });
});
