import { PositionActionService } from '../position-action.service';
import { ActionGateService } from '../action-gate.service';
import { EntryOrderService } from '../entry-order.service';
import { DisabledReactiveCoordination } from '../../reactive/disabled-reactive-coordination.service';
import type { ReactiveCoordinationPort } from '../../reactive/reactive-coordination.port';

const REACTIVE_LOOP_DISABLED_CONFIG = {
  id: 'config-1',
  reactiveLoopEnabled: false,
  maxActionsPerHour: 0,
  minActionIntervalSec: 0,
};

export function createTradingPrismaMock(
  models: Record<string, any> = {},
): any {
  const { tradingConfig, ...otherModels } = models;
  return {
    ...otherModels,
    tradingConfig: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ ...REACTIVE_LOOP_DISABLED_CONFIG }),
      ...tradingConfig,
    },
  };
}

export interface TradingProcessorCollaboratorOverrides {
  prisma?: any;
  gateway?: any;
  notificationsService?: any;
  aggregateRiskService?: any;
  coordination?: ReactiveCoordinationPort;
  actionGate?: ActionGateService;
  entryOrders?: EntryOrderService;
}

export type TradingProcessorCollaborators = [
  PositionActionService,
  ReactiveCoordinationPort,
  ActionGateService,
  EntryOrderService,
];

export function createTradingProcessorCollaborators(
  overrides: TradingProcessorCollaboratorOverrides = {},
): TradingProcessorCollaborators {
  const prisma = overrides.prisma ?? ({} as any);
  const gateway = overrides.gateway ?? ({} as any);
  const notificationsService = overrides.notificationsService ?? ({} as any);
  const aggregateRiskService = overrides.aggregateRiskService ?? ({} as any);
  const coordination =
    overrides.coordination ?? new DisabledReactiveCoordination();
  const positionAction = new PositionActionService(
    prisma,
    gateway,
    notificationsService,
  );
  const actionGate =
    overrides.actionGate ??
    new ActionGateService(prisma, gateway, aggregateRiskService, coordination);

  const entryOrders =
    overrides.entryOrders ??
    new EntryOrderService(
      prisma,
      notificationsService,
      gateway,
      positionAction,
    );

  return [positionAction, coordination, actionGate, entryOrders];
}
