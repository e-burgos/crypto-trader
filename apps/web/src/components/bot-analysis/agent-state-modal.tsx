import { useTranslation } from 'react-i18next';
import { AgentStateModal } from '@crypto-trader/ui';
import type { TradingConfig } from '../../hooks/use-trading';
import type { AgentDecision } from '../../hooks/use-analytics';

export function AgentCurrentStateModal({
  config,
  lastDecision,
  onClose,
}: {
  config: TradingConfig;
  lastDecision: AgentDecision | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AgentStateModal
      config={config}
      lastDecision={lastDecision}
      onClose={onClose}
      labels={{
        currentState: t('botAnalysis.currentState'),
        tabStatus: t('botAnalysis.tabs.status'),
        tabIndicators: t('botAnalysis.tabs.indicators'),
        tabNews: t('botAnalysis.tabs.news'),
        tabConfig: t('botAnalysis.tabs.config'),
        agentStatus: t('botAnalysis.agentStatus'),
        agentLabel: t('agentLog.agent'),
        pairLabel: t('agentLog.pair'),
        modeLabel: t('agentLog.mode'),
        statusLabel: t('agentLog.status'),
        activeStatus: t('agentLog.active'),
        stoppedStatus: t('agentLog.stopped'),
        minIntervalLabel: t('agentLog.minInterval'),
        intervalModeLabel: t('agentLog.intervalMode'),
        lastDecision: t('botAnalysis.lastDecision'),
        decisionResult: t('agentLog.decisionResult'),
        confidenceLabel: t('agentLog.confidence'),
        suggestedWait: t('agentLog.suggestedWait'),
        generatedAt: t('agentLog.generatedAt'),
        providerLabel: t('agentLog.provider'),
        modelLabel: t('agentLog.model'),
        justification: t('botAnalysis.justification'),
        noDecisionsYet: t('botAnalysis.noDecisionsYet'),
        marketSnapshot: t('agentLog.marketSnapshot'),
        histogram: t('botAnalysis.ind.histogram'),
        macdCross: t('botAnalysis.ind.macdCross'),
        emaTrend: t('botAnalysis.ind.emaTrend'),
        bbUpper: t('botAnalysis.ind.bbUpper'),
        bbMiddle: t('botAnalysis.ind.bbMiddle'),
        bbLower: t('botAnalysis.ind.bbLower'),
        bbPosition: t('botAnalysis.ind.bbPosition'),
        volumeCurrent: t('botAnalysis.ind.volumeCurrent'),
        volumeAvg: t('botAnalysis.ind.volumeAvg'),
        volumeRatio: t('botAnalysis.ind.volumeRatio'),
        volumeSignal: t('botAnalysis.ind.volumeSignal'),
        supports: t('botAnalysis.ind.supports'),
        resistances: t('botAnalysis.ind.resistances'),
        noIndicators: t('agentLog.noIndicators', {
          defaultValue: 'Sin indicadores almacenados para la última decisión.',
        }),
        newsProcessed: t('agentLog.newsProcessed'),
        noNews: t('agentLog.noNews', {
          defaultValue: 'Sin noticias almacenadas para la última decisión.',
        }),
        botParameters: t('agentLog.botParameters'),
        buyThreshold: t('agentLog.buyThreshold'),
        sellThreshold: t('agentLog.sellThreshold'),
        stopLoss: t('agentLog.stopLoss'),
        takeProfit: t('agentLog.takeProfit'),
        minProfit: t('agentLog.minProfit'),
        maxCapital: t('agentLog.maxCapital'),
        simultaneousPositions: t('agentLog.simultaneousPositions'),
        minInterval: t('agentLog.minInterval'),
        intervalMode: t('agentLog.intervalMode'),
        priceOffset: t('agentLog.priceOffset'),
        configUsedInLastDecision: t('agentLog.configUsedInLastDecision'),
        configUpdated: t('agentLog.configUpdated'),
        close: t('common.close', { defaultValue: 'Cerrar' }),
      }}
    />
  );
}
