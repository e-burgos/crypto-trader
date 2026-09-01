import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TradingMode } from '@crypto-trader/shared';
import {
  evaluateActionCaps,
  type BotActionKind,
  type ActionCapId,
} from '@crypto-trader/trading-engine';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { AggregateRiskService } from '../agents/domain/aggregate-risk.service';
import {
  REACTIVE_COORDINATION,
  type ReactiveCoordinationPort,
} from '../reactive/reactive-coordination.port';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from '../reactive/reactive-runtime-thresholds';
import { getBotActionCounters } from './bot-action-counters';

export type BotActionSource = 'FAST_PATH' | 'LLM_CYCLE' | 'EXCHANGE_TRIGGER';

export type ActionOutcome = 'EXECUTED' | 'BLOCKED' | 'DEFERRED' | 'SUPERSEDED';

export interface ExpectedPositionState {
  positionStatus: 'OPEN';
  quantity: number;
  partialExitCount: number;
}

export interface ActionRequest {
  userId: string;
  configId: string;
  symbol: string;
  mode: TradingMode;
  kind: BotActionKind;
  source: BotActionSource;
  positionId: string | null;
  decisionId: string | null;
  expected: ExpectedPositionState | null;
  detail: string;
}

export interface ActionResult<T> {
  outcome: ActionOutcome;
  blockedBy: ActionCapId | null;
  detail: string;
  value: T | null;
}

function leaseKeyForBot(configId: string): string {
  return `rx:v1:bot:${configId}`;
}

@Injectable()
export class ActionGateService {
  private readonly logger = new Logger(ActionGateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
    private readonly aggregateRisk: AggregateRiskService,
    @Inject(REACTIVE_COORDINATION)
    private readonly coordination: ReactiveCoordinationPort,
  ) {}

  async authorizeAndRun<T>(
    request: ActionRequest,
    execute: () => Promise<T>,
  ): Promise<ActionResult<T>> {
    const config = await this.prisma.tradingConfig.findUniqueOrThrow({
      where: { id: request.configId },
    });

    if (!config.reactiveLoopEnabled) {
      const value = await execute();
      return {
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'REACTIVE_LOOP_DISABLED',
        value,
      };
    }

    if (!this.coordination.isHealthy()) {
      return {
        outcome: 'BLOCKED',
        blockedBy: null,
        detail: 'COORDINATION_UNAVAILABLE',
        value: null,
      };
    }

    const leaseHolderId = randomUUID();
    const leaseKey = leaseKeyForBot(request.configId);
    const acquired = await this.coordination.tryAcquire(
      leaseKey,
      leaseHolderId,
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.botActionLeaseTtlMs,
    );
    if (!acquired) {
      return {
        outcome: 'DEFERRED',
        blockedBy: null,
        detail: 'BOT_BUSY',
        value: null,
      };
    }

    try {
      const supersededResult = await this.revalidateExpectedState(request);
      if (supersededResult) return supersededResult;

      const now = Date.now();
      const [counters, dailyLoss] = await Promise.all([
        getBotActionCounters(this.prisma, { configId: request.configId, now }),
        this.aggregateRisk.evaluateDailyLoss({
          userId: request.userId,
          mode: request.mode,
        }),
      ]);

      const decision = evaluateActionCaps({
        now,
        kind: request.kind,
        executedActionsInLastHour: counters.executedActionsInLastHour,
        lastExecutedActionAtMs: counters.lastExecutedActionAtMs,
        maxActionsPerHour: config.maxActionsPerHour,
        minActionIntervalMs: config.minActionIntervalSec * 1000,
        dailyLossReached: dailyLoss.reached,
      });

      if (!decision.allowed) {
        const outcome: ActionOutcome =
          decision.disposition === 'DEFERRED' ? 'DEFERRED' : 'BLOCKED';
        await this.recordAction(request, outcome, decision.blockedBy, decision.reason);
        this.gateway.emitToUser(request.userId, 'agent:action-blocked', {
          configId: request.configId,
          symbol: request.symbol,
          kind: request.kind,
          blockedBy: decision.blockedBy,
          detail: decision.reason,
        });
        return {
          outcome,
          blockedBy: decision.blockedBy,
          detail: decision.reason,
          value: null,
        };
      }

      try {
        const value = await execute();
        await this.recordAction(request, 'EXECUTED', null, request.detail);
        return { outcome: 'EXECUTED', blockedBy: null, detail: request.detail, value };
      } catch (err) {
        const detail = `EXECUTION_ERROR: ${err instanceof Error ? err.message : String(err)}`;
        await this.recordAction(request, 'BLOCKED', null, detail).catch((recordErr) => {
          this.logger.error(
            `Failed to record execution error for config ${request.configId}: ${
              recordErr instanceof Error ? recordErr.message : String(recordErr)
            }`,
          );
        });
        throw err;
      }
    } finally {
      await this.coordination.release(leaseKey, leaseHolderId);
    }
  }

  private async revalidateExpectedState(
    request: ActionRequest,
  ): Promise<ActionResult<never> | null> {
    if (!request.expected) return null;

    const position = request.positionId
      ? await this.prisma.position.findUnique({ where: { id: request.positionId } })
      : null;

    const superseded =
      !position ||
      position.status !== request.expected.positionStatus ||
      position.quantity !== request.expected.quantity ||
      position.partialExitCount !== request.expected.partialExitCount;

    if (!superseded) return null;

    await this.recordAction(request, 'SUPERSEDED', null, 'POSITION_CHANGED');
    return {
      outcome: 'SUPERSEDED',
      blockedBy: null,
      detail: 'POSITION_CHANGED',
      value: null,
    };
  }

  private async recordAction(
    request: ActionRequest,
    outcome: ActionOutcome,
    blockedBy: ActionCapId | null,
    detail: string,
  ): Promise<void> {
    await this.prisma.botAction.create({
      data: {
        userId: request.userId,
        configId: request.configId,
        kind: request.kind,
        source: request.source,
        outcome,
        blockedBy,
        positionId: request.positionId,
        decisionId: request.decisionId,
        detail,
      },
    });
  }
}
