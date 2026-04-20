import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  X,
  Activity,
  Clock,
  Newspaper,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  History as HistoryIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { TradingConfig } from '../../hooks/use-trading';
import type { AgentDecision } from '../../hooks/use-analytics';
import { STATE_MODAL_TABS, type StateModalTab } from './constants';
import { StateDetailRow, StateSectionTitle } from './status-card';

export function AgentCurrentStateModal({
  config,
  lastDecision,
  onClose,
}: {
  config: TradingConfig;
  lastDecision: AgentDecision | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<StateModalTab>('estado');
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const modeColor =
    config.mode === 'TESTNET'
      ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
      : config.mode === 'SANDBOX'
        ? 'text-muted-foreground bg-muted/30 border-border'
        : 'text-red-400 bg-red-500/10 border-red-500/20';

  const lastDec = lastDecision;
  const ind = lastDec?.indicators;
  const news = lastDec?.newsHeadlines ?? [];
  const cfg = lastDec?.configDetails;

  const decColor =
    lastDec?.decision === 'BUY'
      ? 'text-emerald-400'
      : lastDec?.decision === 'SELL'
        ? 'text-red-400'
        : 'text-sky-400';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full sm:max-w-xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-primary/5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/20">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {config.name || `${config.asset}/${config.pair}`}
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    modeColor,
                  )}
                >
                  {config.mode}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {config.asset}/{config.pair} · {t('botAnalysis.currentState')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border bg-muted/20">
          {STATE_MODAL_TABS.map(({ id, labelKey, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-all',
                tab === id
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TabIcon className="h-3 w-3 shrink-0" />
              <span className="hidden sm:block">{t(labelKey)}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ── ESTADO TAB ── */}
          {tab === 'estado' && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <StateSectionTitle
                  icon={Activity}
                  title={t('botAnalysis.agentStatus')}
                />
                <div className="space-y-0">
                  <StateDetailRow
                    label={t('agentLog.agent')}
                    value={config.name || `${config.asset}/${config.pair}`}
                  />
                  <StateDetailRow
                    label={t('agentLog.pair')}
                    value={`${config.asset}/${config.pair}`}
                  />
                  <StateDetailRow
                    label={t('agentLog.mode')}
                    value={config.mode}
                  />
                  <StateDetailRow
                    label={t('agentLog.status')}
                    value={
                      config.isActive
                        ? t('agentLog.active')
                        : t('agentLog.stopped')
                    }
                    accent={
                      config.isActive
                        ? 'text-emerald-400'
                        : 'text-muted-foreground'
                    }
                  />
                  <StateDetailRow
                    label={t('agentLog.minInterval')}
                    value={`${config.minIntervalMinutes} min`}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.intervalMode')}
                    value={config.intervalMode}
                  />
                </div>
              </div>

              {lastDec ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <StateSectionTitle
                    icon={Clock}
                    title={t('botAnalysis.lastDecision')}
                  />
                  <div className="space-y-0">
                    <StateDetailRow
                      label={t('agentLog.decisionResult')}
                      value={lastDec.decision}
                      accent={decColor}
                    />
                    <StateDetailRow
                      label={t('agentLog.confidence')}
                      value={`${Math.round(lastDec.confidence * 100)}%`}
                      mono
                      accent={
                        lastDec.confidence >= 0.7
                          ? 'text-emerald-400'
                          : lastDec.confidence >= 0.5
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    />
                    {lastDec.waitMinutes != null && lastDec.waitMinutes > 0 && (
                      <StateDetailRow
                        label={t('agentLog.suggestedWait')}
                        value={`${lastDec.waitMinutes} min`}
                        mono
                      />
                    )}
                    <StateDetailRow
                      label={t('agentLog.generatedAt')}
                      value={new Date(lastDec.createdAt).toLocaleString(
                        undefined,
                        {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    />
                    {lastDec.llmProvider && (
                      <StateDetailRow
                        label={t('agentLog.provider')}
                        value={lastDec.llmProvider}
                      />
                    )}
                    {lastDec.llmModel && (
                      <StateDetailRow
                        label={t('agentLog.model')}
                        value={lastDec.llmModel}
                        mono
                      />
                    )}
                  </div>

                  <div className="mt-3 rounded-lg border border-border/50 bg-card p-3">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {t('botAnalysis.justification')}
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                      {lastDec.reasoning}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <Bot className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-[12px] text-muted-foreground">
                    {t('botAnalysis.noDecisionsYet')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── INDICADORES TAB ── */}
          {tab === 'indicadores' && (
            <>
              {ind ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <StateSectionTitle
                    icon={BarChart3}
                    title={t('agentLog.marketSnapshot')}
                  />
                  <div className="space-y-0">
                    {ind.rsi && (
                      <>
                        <StateDetailRow
                          label="RSI"
                          value={ind.rsi.value.toFixed(2)}
                          mono
                        />
                        <StateDetailRow
                          label="RSI Signal"
                          value={ind.rsi.signal}
                        />
                      </>
                    )}
                    {ind.macd && (
                      <>
                        <StateDetailRow
                          label="MACD"
                          value={ind.macd.macd.toFixed(5)}
                          mono
                        />
                        <StateDetailRow
                          label="MACD Signal"
                          value={ind.macd.signal.toFixed(5)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.histogram')}
                          value={ind.macd.histogram.toFixed(5)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.macdCross')}
                          value={ind.macd.crossover}
                        />
                      </>
                    )}
                    {ind.emaCross && (
                      <>
                        <StateDetailRow
                          label="EMA 9"
                          value={ind.emaCross.ema9.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="EMA 21"
                          value={ind.emaCross.ema21.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="EMA 200"
                          value={ind.emaCross.ema200.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.emaTrend')}
                          value={ind.emaCross.trend}
                        />
                      </>
                    )}
                    {ind.bollingerBands && (
                      <>
                        <StateDetailRow
                          label={t('botAnalysis.ind.bbUpper')}
                          value={ind.bollingerBands.upper.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.bbMiddle')}
                          value={ind.bollingerBands.middle.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.bbLower')}
                          value={ind.bollingerBands.lower.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label="BB Bandwidth"
                          value={ind.bollingerBands.bandwidth.toFixed(4)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.bbPosition')}
                          value={ind.bollingerBands.position}
                        />
                      </>
                    )}
                    {ind.volume && (
                      <>
                        <StateDetailRow
                          label={t('botAnalysis.ind.volumeCurrent')}
                          value={ind.volume.current.toFixed(0)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.volumeAvg')}
                          value={ind.volume.average.toFixed(0)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.volumeRatio')}
                          value={ind.volume.ratio.toFixed(3)}
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.volumeSignal')}
                          value={ind.volume.signal}
                        />
                      </>
                    )}
                    {ind.supportResistance && (
                      <>
                        <StateDetailRow
                          label={t('botAnalysis.ind.supports')}
                          value={
                            ind.supportResistance.support
                              .map((s) => s.toFixed(2))
                              .join(' · ') || '—'
                          }
                          mono
                        />
                        <StateDetailRow
                          label={t('botAnalysis.ind.resistances')}
                          value={
                            ind.supportResistance.resistance
                              .map((r) => r.toFixed(2))
                              .join(' · ') || '—'
                          }
                          mono
                        />
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-muted-foreground">
                  {t('agentLog.noIndicators', {
                    defaultValue:
                      'Sin indicadores almacenados para la última decisión.',
                  })}
                </div>
              )}
            </>
          )}

          {/* ── NOTICIAS TAB ── */}
          {tab === 'noticias' && (
            <>
              {news.length > 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <StateSectionTitle
                    icon={Newspaper}
                    title={t('agentLog.newsProcessed')}
                  />
                  <div className="space-y-2">
                    {news.map((h, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/50 bg-card p-2.5"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase',
                              h.sentiment === 'POSITIVE'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : h.sentiment === 'NEGATIVE'
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {h.sentiment.slice(0, 3)}
                          </span>
                          <p className="text-[11px] leading-snug text-foreground/85 font-medium">
                            {h.headline}
                          </p>
                        </div>
                        {h.summary && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed pl-7">
                            {h.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 pl-7">
                          <span className="text-[10px] text-muted-foreground/60">
                            {h.source}
                          </span>
                          {h.author && (
                            <span className="text-[10px] text-muted-foreground/60">
                              · {h.author}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-muted-foreground">
                  {t('agentLog.noNews', {
                    defaultValue:
                      'Sin noticias almacenadas para la última decisión.',
                  })}
                </div>
              )}
            </>
          )}

          {/* ── CONFIG TAB ── */}
          {tab === 'config' && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <StateSectionTitle
                  icon={ShieldCheck}
                  title={t('agentLog.botParameters')}
                />
                <div className="space-y-0">
                  <StateDetailRow
                    label={t('agentLog.buyThreshold')}
                    value={`${config.buyThreshold}%`}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.sellThreshold')}
                    value={`${config.sellThreshold}%`}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.stopLoss')}
                    value={`${(config.stopLossPct * 100).toFixed(2)}%`}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.takeProfit')}
                    value={`${(config.takeProfitPct * 100).toFixed(2)}%`}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.minProfit')}
                    value={`${(config.minProfitPct * 100).toFixed(2)}%`}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.maxCapital')}
                    value={`${(config.maxTradePct * 100).toFixed(0)}%`}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.simultaneousPositions')}
                    value={String(config.maxConcurrentPositions)}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.minInterval')}
                    value={`${config.minIntervalMinutes} min`}
                    mono
                  />
                  <StateDetailRow
                    label={t('agentLog.intervalMode')}
                    value={config.intervalMode}
                  />
                  {config.orderPriceOffsetPct !== 0 && (
                    <StateDetailRow
                      label={t('agentLog.priceOffset')}
                      value={`${(config.orderPriceOffsetPct * 100).toFixed(2)}%`}
                      mono
                    />
                  )}
                </div>
              </div>

              {cfg && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <StateSectionTitle
                    icon={HistoryIcon}
                    title={t('agentLog.configUsedInLastDecision')}
                  />
                  <div className="space-y-0">
                    <StateDetailRow
                      label={t('agentLog.buyThreshold')}
                      value={`${cfg.buyThreshold}%`}
                      mono
                    />
                    <StateDetailRow
                      label={t('agentLog.sellThreshold')}
                      value={`${cfg.sellThreshold}%`}
                      mono
                    />
                    <StateDetailRow
                      label={t('agentLog.stopLoss')}
                      value={`${(cfg.stopLossPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <StateDetailRow
                      label={t('agentLog.takeProfit')}
                      value={`${(cfg.takeProfitPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <StateDetailRow
                      label={t('agentLog.configUpdated')}
                      value={new Date(cfg.updatedAt).toLocaleDateString()}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between bg-muted/10">
          <span className="text-[10px] text-muted-foreground font-mono">
            {config.id.slice(0, 20)}…
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {t('common.close', { defaultValue: 'Cerrar' })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
