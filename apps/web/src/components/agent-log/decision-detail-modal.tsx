import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Minus,
  X,
  Cpu,
  Settings2,
  BarChart3,
  Newspaper,
  TrendingUp,
  Zap,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { type AgentDecision } from '../../hooks/use-analytics';
import {
  DECISION_COLOR,
  DECISION_BG,
  DECISION_BORDER,
  DECISION_ICON,
  MODAL_TABS,
  type ModalTab,
} from './constants';
import { DetailRow, SectionTitle } from './detail-helpers';

export function DecisionDetailModal({
  decision,
  onClose,
}: {
  decision: AgentDecision;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ModalTab>('input');
  const { t } = useTranslation();
  const color = DECISION_COLOR[decision.decision] ?? 'text-amber-500';
  const bg = DECISION_BG[decision.decision] ?? 'bg-amber-500/10';
  const border = DECISION_BORDER[decision.decision] ?? 'border-amber-500/20';
  const Icon = DECISION_ICON[decision.decision] ?? Minus;
  const cfg = decision.configDetails;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ind = decision.indicators;
  const news = decision.newsHeadlines ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full sm:max-w-xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 shrink-0',
            bg.replace('/10', '/8'),
          )}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full',
                bg,
                color,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-extrabold uppercase tracking-wider',
                    color,
                  )}
                >
                  {decision.decision}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {decision.asset}/{decision.pair}
                </span>
                {decision.mode && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      decision.mode === 'SANDBOX'
                        ? 'bg-muted text-muted-foreground'
                        : decision.mode === 'TESTNET'
                          ? 'bg-sky-500/10 text-sky-400'
                          : 'bg-red-500/10 text-red-400',
                    )}
                  >
                    {decision.mode}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {new Date(decision.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
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
          {MODAL_TABS.map(({ id, label, icon: TabIcon }) => (
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
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ── INPUT TAB ── */}
          {tab === 'input' && (
            <>
              {ind && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <SectionTitle
                    icon={BarChart3}
                    title={t('agentLog.marketSnapshot')}
                  />
                  <div className="space-y-0">
                    {ind.rsi && (
                      <>
                        <DetailRow
                          label="RSI"
                          value={ind.rsi.value.toFixed(2)}
                          mono
                        />
                        <DetailRow label="RSI Signal" value={ind.rsi.signal} />
                      </>
                    )}
                    {ind.macd && (
                      <>
                        <DetailRow
                          label="MACD"
                          value={ind.macd.macd.toFixed(5)}
                          mono
                        />
                        <DetailRow
                          label="MACD Signal"
                          value={ind.macd.signal.toFixed(5)}
                          mono
                        />
                        <DetailRow
                          label="MACD Histogram"
                          value={ind.macd.histogram.toFixed(5)}
                          mono
                        />
                        <DetailRow
                          label="MACD Crossover"
                          value={ind.macd.crossover}
                        />
                      </>
                    )}
                    {ind.emaCross && (
                      <>
                        <DetailRow
                          label="EMA 9"
                          value={ind.emaCross.ema9.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="EMA 21"
                          value={ind.emaCross.ema21.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="EMA 200"
                          value={ind.emaCross.ema200.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="EMA Trend"
                          value={ind.emaCross.trend}
                        />
                      </>
                    )}
                    {ind.bollingerBands && (
                      <>
                        <DetailRow
                          label="BB Upper"
                          value={ind.bollingerBands.upper.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="BB Middle"
                          value={ind.bollingerBands.middle.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="BB Lower"
                          value={ind.bollingerBands.lower.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="BB Bandwidth"
                          value={ind.bollingerBands.bandwidth.toFixed(4)}
                          mono
                        />
                        <DetailRow
                          label="BB Position"
                          value={ind.bollingerBands.position}
                        />
                      </>
                    )}
                    {ind.volume && (
                      <>
                        <DetailRow
                          label="Volume (actual)"
                          value={ind.volume.current.toFixed(0)}
                          mono
                        />
                        <DetailRow
                          label="Volume (promedio)"
                          value={ind.volume.average.toFixed(0)}
                          mono
                        />
                        <DetailRow
                          label="Volume Ratio"
                          value={ind.volume.ratio.toFixed(3)}
                          mono
                        />
                        <DetailRow
                          label="Volume Signal"
                          value={ind.volume.signal}
                        />
                      </>
                    )}
                    {ind.supportResistance && (
                      <>
                        <DetailRow
                          label="Soportes"
                          value={
                            ind.supportResistance.support
                              .map((s) => s.toFixed(2))
                              .join(' · ') || '—'
                          }
                          mono
                        />
                        <DetailRow
                          label="Resistencias"
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
              )}

              {news.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <SectionTitle
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
              )}

              {!ind && news.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-muted-foreground">
                  Sin datos de entrada almacenados para esta decisión.
                </div>
              )}
            </>
          )}

          {/* ── OUTPUT TAB ── */}
          {tab === 'output' && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <SectionTitle
                icon={TrendingUp}
                title={t('agentLog.decisionResult')}
              />
              <div className="mb-4">
                <div
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2',
                    bg,
                    border,
                    'border',
                  )}
                >
                  <Icon className={cn('h-5 w-5', color)} />
                  <span
                    className={cn(
                      'text-base font-extrabold uppercase tracking-wide',
                      color,
                    )}
                  >
                    {decision.decision}
                  </span>
                </div>
              </div>
              <div className="space-y-0 mb-4">
                <DetailRow
                  label={t('agentLog.confidence')}
                  value={`${Math.round(decision.confidence * 100)}%`}
                  mono
                  accent={
                    decision.confidence >= 0.7
                      ? 'text-emerald-400'
                      : decision.confidence >= 0.5
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }
                />
                {decision.waitMinutes != null && decision.waitMinutes > 0 && (
                  <DetailRow
                    label={t('agentLog.suggestedWait')}
                    value={`${decision.waitMinutes} min`}
                    mono
                  />
                )}
                <DetailRow
                  label={t('agentLog.generatedAt')}
                  value={new Date(decision.createdAt).toLocaleString(
                    undefined,
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    },
                  )}
                />
                {decision.configName && (
                  <DetailRow
                    label={t('agentLog.agent')}
                    value={decision.configName}
                  />
                )}
                {decision.mode && (
                  <DetailRow label={t('agentLog.mode')} value={decision.mode} />
                )}
              </div>

              <div className="rounded-lg border border-border/50 bg-card p-3">
                <SectionTitle
                  icon={Zap}
                  title={t('agentLog.llmJustification')}
                />
                <p className="text-[12px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                  {decision.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* ── CONFIG TAB ── */}
          {tab === 'config' && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <SectionTitle
                  icon={ShieldCheck}
                  title={t('agentLog.operationMode')}
                />
                <div className="space-y-0">
                  <DetailRow
                    label={t('agentLog.mode')}
                    value={decision.mode ?? '—'}
                  />
                  <DetailRow
                    label={t('agentLog.pair')}
                    value={`${decision.asset}/${decision.pair}`}
                  />
                  {decision.configName && (
                    <DetailRow
                      label={t('agentLog.botName')}
                      value={decision.configName}
                    />
                  )}
                  {decision.configId && (
                    <DetailRow
                      label={t('agentLog.configId')}
                      value={decision.configId.slice(0, 16) + '…'}
                      mono
                    />
                  )}
                </div>
              </div>

              {cfg ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <SectionTitle
                    icon={Settings2}
                    title={t('agentLog.botParameters')}
                  />
                  <div className="space-y-0">
                    <DetailRow
                      label={t('agentLog.buyThreshold')}
                      value={`${cfg.buyThreshold}%`}
                      mono
                    />
                    <DetailRow
                      label={t('agentLog.sellThreshold')}
                      value={`${cfg.sellThreshold}%`}
                      mono
                    />
                    <DetailRow
                      label={t('agentLog.stopLoss')}
                      value={`${(cfg.stopLossPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <DetailRow
                      label={t('agentLog.takeProfit')}
                      value={`${(cfg.takeProfitPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <DetailRow
                      label={t('agentLog.minProfit')}
                      value={`${(cfg.minProfitPct * 100).toFixed(2)}%`}
                      mono
                    />
                    <DetailRow
                      label={t('agentLog.maxCapital')}
                      value={`${(cfg.maxTradePct * 100).toFixed(0)}%`}
                      mono
                    />
                    <DetailRow
                      label={t('agentLog.simultaneousPositions')}
                      value={String(cfg.maxConcurrentPositions)}
                      mono
                    />
                    <DetailRow
                      label={t('agentLog.minInterval')}
                      value={`${cfg.minIntervalMinutes} min`}
                      mono
                    />
                    <DetailRow
                      label={t('agentLog.intervalMode')}
                      value={cfg.intervalMode}
                    />
                    {cfg.orderPriceOffsetPct !== 0 && (
                      <DetailRow
                        label={t('agentLog.priceOffset')}
                        value={`${(cfg.orderPriceOffsetPct * 100).toFixed(2)}%`}
                        mono
                      />
                    )}
                    <DetailRow
                      label={t('agentLog.status')}
                      value={
                        cfg.isRunning
                          ? t('agentLog.active')
                          : t('agentLog.stopped')
                      }
                      accent={
                        cfg.isRunning
                          ? 'text-emerald-400'
                          : 'text-muted-foreground'
                      }
                    />
                    <DetailRow
                      label={t('agentLog.configCreated')}
                      value={new Date(cfg.createdAt).toLocaleDateString()}
                    />
                    <DetailRow
                      label={t('agentLog.lastUpdated')}
                      value={new Date(cfg.updatedAt).toLocaleDateString()}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-muted-foreground">
                  Configuración del bot no disponible para esta decisión.
                </div>
              )}
            </>
          )}

          {/* ── PROVIDER TAB ── */}
          {tab === 'provider' && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <SectionTitle
                icon={Cpu}
                title={t('agentLog.activeLlmProvider')}
              />
              {decision.llmProvider || decision.llmModel ? (
                <div className="space-y-0">
                  {decision.llmProvider && (
                    <DetailRow
                      label={t('agentLog.provider')}
                      value={decision.llmProvider}
                    />
                  )}
                  {decision.llmModel && (
                    <DetailRow
                      label={t('agentLog.model')}
                      value={decision.llmModel}
                      mono
                    />
                  )}
                  <DetailRow
                    label={t('agentLog.processed')}
                    value={new Date(decision.createdAt).toLocaleString(
                      undefined,
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      },
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-0">
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    El proveedor y modelo LLM corresponden al configurado
                    activamente en tu cuenta al momento de ejecutar esta
                    decisión.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    <span>
                      Configura tu proveedor LLM en Ajustes → Integraciones.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between bg-muted/10">
          <span className="text-[10px] text-muted-foreground font-mono">
            ID: {decision.id.slice(0, 20)}…
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
