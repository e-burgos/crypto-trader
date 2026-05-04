import {
  Gauge,
  TrendingUp,
  Shield,
  BarChart3,
  Newspaper,
  Target,
  Unlock,
  Activity,
} from 'lucide-react';
import type { TabModalTab } from '@crypto-trader/ui';
import type { TFunction } from 'i18next';

const p = 'marketIntelligence.info';

/* ─── Fear & Greed ─────────────────────────────────────────────────────────── */

export function getFearGreedInfo(t: TFunction): TabModalTab[] {
  return [
    {
      icon: Gauge,
      name: t(`${p}.tabs.indicators`),
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t(`${p}.fearGreed.desc`)}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <span className="text-red-400 font-semibold">0–24:</span>{' '}
              {t(`${p}.fearGreed.extremeFear`)}
            </li>
            <li>
              <span className="text-orange-400 font-semibold">25–44:</span>{' '}
              {t(`${p}.fearGreed.fear`)}
            </li>
            <li>
              <span className="text-yellow-400 font-semibold">45–55:</span>{' '}
              {t(`${p}.fearGreed.neutral`)}
            </li>
            <li>
              <span className="text-green-400 font-semibold">56–75:</span>{' '}
              {t(`${p}.fearGreed.greed`)}
            </li>
            <li>
              <span className="text-emerald-400 font-semibold">76–100:</span>{' '}
              {t(`${p}.fearGreed.extremeGreed`)}
            </li>
          </ul>
          <p className="text-muted-foreground">
            <strong>Δ Previous Close:</strong> {t(`${p}.fearGreed.delta`)}
          </p>
          <p className="text-xs text-muted-foreground/60">
            {t(`${p}.fearGreed.source`)}
          </p>
        </div>
      ),
    },
    {
      icon: Activity,
      name: t(`${p}.tabs.agentUsage`),
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t(`${p}.fearGreed.agentIntro`)}</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>{t(`${p}.fearGreed.agentRiskLabel`)}:</strong>{' '}
              {t(`${p}.fearGreed.agentRiskDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.fearGreed.agentContrarianLabel`)}:</strong>{' '}
              {t(`${p}.fearGreed.agentContrarianDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.fearGreed.agentTrendLabel`)}:</strong>{' '}
              {t(`${p}.fearGreed.agentTrendDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.fearGreed.agentExitLabel`)}:</strong>{' '}
              {t(`${p}.fearGreed.agentExitDesc`)}
            </li>
          </ul>
        </div>
      ),
    },
  ];
}

/* ─── Derivatives ──────────────────────────────────────────────────────────── */

export function getDerivativesInfo(t: TFunction): TabModalTab[] {
  return [
    {
      icon: TrendingUp,
      name: t(`${p}.tabs.indicators`),
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t(`${p}.derivatives.desc`)}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>{t(`${p}.derivatives.lsRatioLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.lsRatioDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.derivatives.oiLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.oiDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.derivatives.oiChangeLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.oiChangeDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.derivatives.fundingLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.fundingDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.derivatives.liqLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.liqDesc`)}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground/60">
            {t(`${p}.derivatives.source`)}
          </p>
        </div>
      ),
    },
    {
      icon: Activity,
      name: t(`${p}.tabs.agentUsage`),
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t(`${p}.derivatives.agentIntro`)}</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>{t(`${p}.derivatives.agentCrowdedLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.agentCrowdedDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.derivatives.agentConfluenceLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.agentConfluenceDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.derivatives.agentLiqAlertLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.agentLiqAlertDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.derivatives.agentSizingLabel`)}:</strong>{' '}
              {t(`${p}.derivatives.agentSizingDesc`)}
            </li>
          </ul>
        </div>
      ),
    },
  ];
}

/* ─── DeFi Health ──────────────────────────────────────────────────────────── */

export function getDefiHealthInfo(t: TFunction): TabModalTab[] {
  return [
    {
      icon: Shield,
      name: t(`${p}.tabs.indicators`),
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t(`${p}.defiHealth.desc`)}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>{t(`${p}.defiHealth.tvlLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.tvlDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.defiHealth.tvlChangeLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.tvlChangeDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.defiHealth.stableMcapLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.stableMcapDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.defiHealth.stableChangeLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.stableChangeDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.defiHealth.dominantLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.dominantDesc`)}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground/60">
            {t(`${p}.defiHealth.source`)}
          </p>
        </div>
      ),
    },
    {
      icon: Activity,
      name: t(`${p}.tabs.agentUsage`),
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t(`${p}.defiHealth.agentIntro`)}</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>{t(`${p}.defiHealth.agentMacroLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.agentMacroDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.defiHealth.agentRiskOffLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.agentRiskOffDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.defiHealth.agentTimingLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.agentTimingDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.defiHealth.agentCrossChainLabel`)}:</strong>{' '}
              {t(`${p}.defiHealth.agentCrossChainDesc`)}
            </li>
          </ul>
        </div>
      ),
    },
  ];
}

/* ─── Global Market ────────────────────────────────────────────────────────── */

export function getGlobalMarketInfo(t: TFunction): TabModalTab[] {
  return [
    {
      icon: BarChart3,
      name: t(`${p}.tabs.indicators`),
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t(`${p}.globalMarket.desc`)}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>{t(`${p}.globalMarket.mcapLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.mcapDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.globalMarket.volLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.volDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.globalMarket.btcDomLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.btcDomDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.globalMarket.ethDomLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.ethDomDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.globalMarket.moversLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.moversDesc`)}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground/60">
            {t(`${p}.globalMarket.source`)}
          </p>
        </div>
      ),
    },
    {
      icon: Activity,
      name: t(`${p}.tabs.agentUsage`),
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t(`${p}.globalMarket.agentIntro`)}</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>{t(`${p}.globalMarket.agentAltseasonLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.agentAltseasonDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.globalMarket.agentVolumeLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.agentVolumeDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.globalMarket.agentNarrativeLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.agentNarrativeDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.globalMarket.agentRiskLabel`)}:</strong>{' '}
              {t(`${p}.globalMarket.agentRiskDesc`)}
            </li>
          </ul>
        </div>
      ),
    },
  ];
}

/* ─── News & Sentiment ─────────────────────────────────────────────────────── */

export function getNewsSentimentInfo(t: TFunction): TabModalTab[] {
  return [
    {
      icon: Newspaper,
      name: t(`${p}.tabs.indicators`),
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t(`${p}.news.desc`)}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>{t(`${p}.news.scoreLabel`)}:</strong>{' '}
              {t(`${p}.news.scoreDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.news.distLabel`)}:</strong>{' '}
              {t(`${p}.news.distDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.news.avgLabel`)}:</strong>{' '}
              {t(`${p}.news.avgDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.news.barLabel`)}:</strong>{' '}
              {t(`${p}.news.barDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.news.symbolsLabel`)}:</strong>{' '}
              {t(`${p}.news.symbolsDesc`)}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground/60">
            {t(`${p}.news.source`)}
          </p>
        </div>
      ),
    },
    {
      icon: Activity,
      name: t(`${p}.tabs.agentUsage`),
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t(`${p}.news.agentIntro`)}</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>{t(`${p}.news.agentEventLabel`)}:</strong>{' '}
              {t(`${p}.news.agentEventDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.news.agentNoiseLabel`)}:</strong>{' '}
              {t(`${p}.news.agentNoiseDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.news.agentTrendLabel`)}:</strong>{' '}
              {t(`${p}.news.agentTrendDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.news.agentRiskLabel`)}:</strong>{' '}
              {t(`${p}.news.agentRiskDesc`)}
            </li>
          </ul>
        </div>
      ),
    },
  ];
}

/* ─── Prediction Markets ───────────────────────────────────────────────────── */

export function getPredictionsInfo(t: TFunction): TabModalTab[] {
  return [
    {
      icon: Target,
      name: t(`${p}.tabs.indicators`),
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t(`${p}.predictions.desc`)}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>{t(`${p}.predictions.probLabel`)}:</strong>{' '}
              {t(`${p}.predictions.probDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.predictions.volumeLabel`)}:</strong>{' '}
              {t(`${p}.predictions.volumeDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.predictions.endDateLabel`)}:</strong>{' '}
              {t(`${p}.predictions.endDateDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.predictions.colorLabel`)}:</strong>{' '}
              {t(`${p}.predictions.colorDesc`)}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground/60">
            {t(`${p}.predictions.source`)}
          </p>
        </div>
      ),
    },
    {
      icon: Activity,
      name: t(`${p}.tabs.agentUsage`),
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t(`${p}.predictions.agentIntro`)}</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>{t(`${p}.predictions.agentForwardLabel`)}:</strong>{' '}
              {t(`${p}.predictions.agentForwardDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.predictions.agentConsensusLabel`)}:</strong>{' '}
              {t(`${p}.predictions.agentConsensusDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.predictions.agentCatalystLabel`)}:</strong>{' '}
              {t(`${p}.predictions.agentCatalystDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.predictions.agentRiskLabel`)}:</strong>{' '}
              {t(`${p}.predictions.agentRiskDesc`)}
            </li>
          </ul>
        </div>
      ),
    },
  ];
}

/* ─── Token Unlocks ────────────────────────────────────────────────────────── */

export function getTokenUnlocksInfo(t: TFunction): TabModalTab[] {
  return [
    {
      icon: Unlock,
      name: t(`${p}.tabs.indicators`),
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t(`${p}.unlockInfo.desc`)}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>{t(`${p}.unlockInfo.dateLabel`)}:</strong>{' '}
              {t(`${p}.unlockInfo.dateDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.unlockInfo.amountLabel`)}:</strong>{' '}
              {t(`${p}.unlockInfo.amountDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.unlockInfo.pctLabel`)}:</strong>{' '}
              {t(`${p}.unlockInfo.pctDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.unlockInfo.symbolLabel`)}:</strong>{' '}
              {t(`${p}.unlockInfo.symbolDesc`)}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground/60">
            {t(`${p}.unlockInfo.source`)}
          </p>
        </div>
      ),
    },
    {
      icon: Activity,
      name: t(`${p}.tabs.agentUsage`),
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t(`${p}.unlockInfo.agentIntro`)}</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>{t(`${p}.unlockInfo.agentCliffLabel`)}:</strong>{' '}
              {t(`${p}.unlockInfo.agentCliffDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.unlockInfo.agentShortLabel`)}:</strong>{' '}
              {t(`${p}.unlockInfo.agentShortDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.unlockInfo.agentProtectLabel`)}:</strong>{' '}
              {t(`${p}.unlockInfo.agentProtectDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.unlockInfo.agentRecoveryLabel`)}:</strong>{' '}
              {t(`${p}.unlockInfo.agentRecoveryDesc`)}
            </li>
          </ul>
        </div>
      ),
    },
  ];
}

/* ─── Technical Signals ────────────────────────────────────────────────────── */

export function getTechnicalSignalsInfo(t: TFunction): TabModalTab[] {
  return [
    {
      icon: Activity,
      name: t(`${p}.tabs.indicators`),
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {t(`${p}.technicalSignals.desc`)}
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>{t(`${p}.technicalSignals.nameLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.nameDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.technicalSignals.dirLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.dirDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.technicalSignals.symbolLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.symbolDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.technicalSignals.priceLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.priceDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.technicalSignals.donutLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.donutDesc`)}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground/60">
            {t(`${p}.technicalSignals.source`)}
          </p>
        </div>
      ),
    },
    {
      icon: Activity,
      name: t(`${p}.tabs.agentUsage`),
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t(`${p}.technicalSignals.agentIntro`)}</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              <strong>{t(`${p}.technicalSignals.agentMultiLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.agentMultiDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.technicalSignals.agentFilterLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.agentFilterDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.technicalSignals.agentTimingLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.agentTimingDesc`)}
            </li>
            <li>
              <strong>{t(`${p}.technicalSignals.agentExitLabel`)}:</strong>{' '}
              {t(`${p}.technicalSignals.agentExitDesc`)}
            </li>
          </ul>
        </div>
      ),
    },
  ];
}
