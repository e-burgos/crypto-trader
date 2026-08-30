import type { PrismaService } from '../prisma/prisma.service';

const ROLLING_WINDOW_MS = 60 * 60 * 1000;

export interface BotActionCounters {
  executedActionsInLastHour: number;
  lastExecutedActionAtMs: number | null;
}

export interface GetBotActionCountersInput {
  configId: string;
  now: number;
}

export async function getBotActionCounters(
  prisma: PrismaService,
  input: GetBotActionCountersInput,
): Promise<BotActionCounters> {
  const windowStart = new Date(input.now - ROLLING_WINDOW_MS);

  const result = await prisma.botAction.aggregate({
    where: {
      configId: input.configId,
      outcome: 'EXECUTED',
      occurredAt: { gte: windowStart },
    },
    _count: { _all: true },
    _max: { occurredAt: true },
  });

  return {
    executedActionsInLastHour: result._count._all,
    lastExecutedActionAtMs: result._max.occurredAt
      ? result._max.occurredAt.getTime()
      : null,
  };
}
