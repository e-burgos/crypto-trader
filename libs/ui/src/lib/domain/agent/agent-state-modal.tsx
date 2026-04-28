import {
  Bot,
  Activity,
  Clock,
  Newspaper,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  History as HistoryIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '../../utils';
import { TabModal } from '../../composites/tab-modal';

// ─── Domain types ────────────────────────────────────────────────────────────

export type AgentTradingMode = 'SANDBOX' | 'LIVE' | 'TESTNET';

export interface AgentStateConfig {
  id: string;
  name?: string;
  asset: string;
  pair: string;
  mode: AgentTradingMode;
  isActive: boolean;
  minIntervalMinutes: number;
  intervalMode: string;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  minProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  orderPriceOffsetPct: number;
}

export interface AgentStateIndicators {
  rsi?: { value: number; signal: string };
  macd?: { macd: number; signal: number; histogram: number; crossover: string };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    position: string;
  };
  emaCross?: {
    ema9: number;
    ema21: number;
    ema200: number;
    trend: string;
  };
  volume?: { current: number; average: number; ratio: number; signal: string };
  supportResistance?: { support: number[]; resistance: number[] };
}

export interface AgentStateHeadline {
  headline: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  summary?: string | null;
  author?: string | null;
  source: string;
}

export interface AgentStateConfigDetails {
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  updatedAt: string;
}

export interface AgentDecisionData {
  id: string;
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string;
  waitMinutes?: number | null;
  createdAt: string;
  llmProvider?: string | null;
  llmModel?: string | null;
  indicators?: AgentStateIndicators;
  newsHeadlines?: AgentStateHeadline[];
  configDetails?: AgentStateConfigDetails | null;
}

// ─── Labels (i18n-friendly) ──────────────────────────────────────────────────

export interface AgentStateModalLabels {
  // Header
  currentState: string;
  // Tabs
  tabStatus: string;
  tabIndicators: string;
  tabNews: string;
  tabConfig: string;
  // Status section
  agentStatus: string;
  agentLabel: string;
  pairLabel: string;
  modeLabel: string;
  statusLabel: string;
  activeStatus: string;
  stoppedStatus: string;
  minIntervalLabel: string;
  intervalModeLabel: string;
  // Decision section
  lastDecision: string;
  decisionResult: string;
  confidenceLabel: string;
  suggestedWait: string;
  generatedAt: string;
  providerLabel: string;
  modelLabel: string;
  justification: string;
  noDecisionsYet: string;
  // Indicators section
  marketSnapshot: string;
  histogram: string;
  macdCross: string;
  emaTrend: string;
  bbUpper: string;
  bbMiddle: string;
  bbLower: string;
  bbPosition: string;
  volumeCurrent: string;
  volumeAvg: string;
  volumeRatio: string;
  volumeSignal: string;
  supports: string;
  resistances: string;
  noIndicators: string;
  // News section
  newsProcessed: string;
  noNews: string;
  // Config section
  botParameters: string;
  buyThreshold: string;
  sellThreshold: string;
  stopLoss: string;
  takeProfit: string;
  minProfit: string;
  maxCapital: string;
  simultaneousPositions: string;
  minInterval: string;
  intervalMode: string;
  priceOffset: string;
  configUsedInLastDecision: string;
  configUpdated: string;
  // Footer
  close: string;
}

const DEFAULT_LABELS: AgentStateModalLabels = {
  currentState: 'Estado actual',
  tabStatus: 'Estado',
  tabIndicators: 'Indicadores',
  tabNews: 'Noticias',
  tabConfig: 'Config',
  agentStatus: 'Estado del agente',
  agentLabel: 'Agente',
  pairLabel: 'Par',
  modeLabel: 'Modo',
  statusLabel: 'Estado',
  activeStatus: 'Activo',
  stoppedStatus: 'Detenido',
  minIntervalLabel: 'Intervalo mínimo',
  intervalModeLabel: 'Modo intervalo',
  lastDecision: 'Última decisión IA',
  decisionResult: 'Resultado de la decisión',
  confidenceLabel: 'Confianza',
  suggestedWait: 'Espera sugerida',
  generatedAt: 'Generada el',
  providerLabel: 'Proveedor',
  modelLabel: 'Modelo',
  justification: 'Justificación',
  noDecisionsYet: 'Sin decisiones registradas aún.',
  marketSnapshot: 'Snapshot de mercado',
  histogram: 'Histograma',
  macdCross: 'Cruce MACD',
  emaTrend: 'Tendencia EMA',
  bbUpper: 'BB Superior',
  bbMiddle: 'BB Medio',
  bbLower: 'BB Inferior',
  bbPosition: 'Posición BB',
  volumeCurrent: 'Volumen actual',
  volumeAvg: 'Volumen promedio',
  volumeRatio: 'Ratio volumen',
  volumeSignal: 'Señal volumen',
  supports: 'Soportes',
  resistances: 'Resistencias',
  noIndicators: 'Sin indicadores almacenados para la última decisión.',
  newsProcessed: 'Noticias procesadas',
  noNews: 'Sin noticias almacenadas para la última decisión.',
  botParameters: 'Parámetros del bot',
  buyThreshold: 'Umbral compra',
  sellThreshold: 'Umbral venta',
  stopLoss: 'Stop Loss',
  takeProfit: 'Take Profit',
  minProfit: 'Beneficio mínimo',
  maxCapital: 'Capital máximo',
  simultaneousPositions: 'Posiciones simultáneas',
  minInterval: 'Intervalo mínimo',
  intervalMode: 'Modo intervalo',
  priceOffset: 'Offset precio',
  configUsedInLastDecision: 'Config usada en última decisión',
  configUpdated: 'Actualizada el',
  close: 'Cerrar',
};

// ─── Sub-components (exported for reuse) ─────────────────────────────────────

export interface StateDetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
}

export function StateDetailRow({
  label,
  value,
  mono = false,
  accent,
}: StateDetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={cn(
          'text-[12px] font-semibold text-right',
          mono && 'font-mono tabular-nums',
          accent ?? 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export interface StateSectionTitleProps {
  icon: React.ElementType;
  title: string;
}

export function StateSectionTitle({
  icon: Icon,
  title,
}: StateSectionTitleProps) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface AgentStateModalProps {
  config: AgentStateConfig;
  lastDecision: AgentDecisionData | null;
  onClose: () => void;
  labels?: Partial<AgentStateModalLabels>;
}

export function AgentStateModal({
  config,
  lastDecision,
  onClose,
  labels: labelOverrides,
}: AgentStateModalProps) {
  const labels: AgentStateModalLabels = {
    ...DEFAULT_LABELS,
    ...labelOverrides,
  };

  const modeColor =
    config.mode === 'TESTNET'
      ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
      : config.mode === 'SANDBOX'
        ? 'text-muted-foreground bg-muted/30 border-border'
        : 'text-red-400 bg-red-500/10 border-red-500/20';

  const ind = lastDecision?.indicators;
  const news = lastDecision?.newsHeadlines ?? [];
  const cfg = lastDecision?.configDetails;

  const decColor =
    lastDecision?.decision === 'BUY'
      ? 'text-emerald-400'
      : lastDecision?.decision === 'SELL'
        ? 'text-red-400'
        : 'text-sky-400';

  // ── Tab contents ──────────────────────────────────────────────────────────

  const estadoContent = (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <StateSectionTitle icon={Activity} title={labels.agentStatus} />
        <div className="space-y-0">
          <StateDetailRow
            label={labels.agentLabel}
            value={config.name || `${config.asset}/${config.pair}`}
          />
          <StateDetailRow
            label={labels.pairLabel}
            value={`${config.asset}/${config.pair}`}
          />
          <StateDetailRow label={labels.modeLabel} value={config.mode} />
          <StateDetailRow
            label={labels.statusLabel}
            value={config.isActive ? labels.activeStatus : labels.stoppedStatus}
            accent={
              config.isActive ? 'text-emerald-400' : 'text-muted-foreground'
            }
          />
          <StateDetailRow
            label={labels.minIntervalLabel}
            value={`${config.minIntervalMinutes} min`}
            mono
          />
          <StateDetailRow
            label={labels.intervalModeLabel}
            value={config.intervalMode}
          />
        </div>
      </div>

      {lastDecision ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <StateSectionTitle icon={Clock} title={labels.lastDecision} />
          <div className="space-y-0">
            <StateDetailRow
              label={labels.decisionResult}
              value={lastDecision.decision}
              accent={decColor}
            />
            <StateDetailRow
              label={labels.confidenceLabel}
              value={`${Math.round(lastDecision.confidence * 100)}%`}
              mono
              accent={
                lastDecision.confidence >= 0.7
                  ? 'text-emerald-400'
                  : lastDecision.confidence >= 0.5
                    ? 'text-amber-400'
                    : 'text-red-400'
              }
            />
            {lastDecision.waitMinutes != null &&
              lastDecision.waitMinutes > 0 && (
                <StateDetailRow
                  label={labels.suggestedWait}
                  value={`${lastDecision.waitMinutes} min`}
                  mono
                />
              )}
            <StateDetailRow
              label={labels.generatedAt}
              value={new Date(lastDecision.createdAt).toLocaleString(
                undefined,
                {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )}
            />
            {lastDecision.llmProvider && (
              <StateDetailRow
                label={labels.providerLabel}
                value={lastDecision.llmProvider}
              />
            )}
            {lastDecision.llmModel && (
              <StateDetailRow
                label={labels.modelLabel}
                value={lastDecision.llmModel}
                mono
              />
            )}
          </div>
          <div className="mt-3 rounded-lg border border-border/50 bg-card p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {labels.justification}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
              {lastDecision.reasoning}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Bot className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-[12px] text-muted-foreground">
            {labels.noDecisionsYet}
          </p>
        </div>
      )}
    </div>
  );

  const indicadoresContent = (
    <div className="space-y-4">
      {ind ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <StateSectionTitle icon={BarChart3} title={labels.marketSnapshot} />
          <div className="space-y-0">
            {ind.rsi && (
              <>
                <StateDetailRow
                  label="RSI"
                  value={ind.rsi.value.toFixed(2)}
                  mono
                />
                <StateDetailRow label="RSI Signal" value={ind.rsi.signal} />
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
                  label={labels.histogram}
                  value={ind.macd.histogram.toFixed(5)}
                  mono
                />
                <StateDetailRow
                  label={labels.macdCross}
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
                  label={labels.emaTrend}
                  value={ind.emaCross.trend}
                />
              </>
            )}
            {ind.bollingerBands && (
              <>
                <StateDetailRow
                  label={labels.bbUpper}
                  value={ind.bollingerBands.upper.toFixed(4)}
                  mono
                />
                <StateDetailRow
                  label={labels.bbMiddle}
                  value={ind.bollingerBands.middle.toFixed(4)}
                  mono
                />
                <StateDetailRow
                  label={labels.bbLower}
                  value={ind.bollingerBands.lower.toFixed(4)}
                  mono
                />
                <StateDetailRow
                  label="BB Bandwidth"
                  value={ind.bollingerBands.bandwidth.toFixed(4)}
                  mono
                />
                <StateDetailRow
                  label={labels.bbPosition}
                  value={ind.bollingerBands.position}
                />
              </>
            )}
            {ind.volume && (
              <>
                <StateDetailRow
                  label={labels.volumeCurrent}
                  value={ind.volume.current.toFixed(0)}
                  mono
                />
                <StateDetailRow
                  label={labels.volumeAvg}
                  value={ind.volume.average.toFixed(0)}
                  mono
                />
                <StateDetailRow
                  label={labels.volumeRatio}
                  value={ind.volume.ratio.toFixed(3)}
                  mono
                />
                <StateDetailRow
                  label={labels.volumeSignal}
                  value={ind.volume.signal}
                />
              </>
            )}
            {ind.supportResistance && (
              <>
                <StateDetailRow
                  label={labels.supports}
                  value={
                    ind.supportResistance.support
                      .map((s) => s.toFixed(2))
                      .join(' · ') || '—'
                  }
                  mono
                />
                <StateDetailRow
                  label={labels.resistances}
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
          {labels.noIndicators}
        </div>
      )}
    </div>
  );

  const noticiasContent = (
    <div className="space-y-4">
      {news.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <StateSectionTitle icon={Newspaper} title={labels.newsProcessed} />
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
          {labels.noNews}
        </div>
      )}
    </div>
  );

  const configContent = (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <StateSectionTitle icon={ShieldCheck} title={labels.botParameters} />
        <div className="space-y-0">
          <StateDetailRow
            label={labels.buyThreshold}
            value={`${config.buyThreshold}%`}
            mono
          />
          <StateDetailRow
            label={labels.sellThreshold}
            value={`${config.sellThreshold}%`}
            mono
          />
          <StateDetailRow
            label={labels.stopLoss}
            value={`${(config.stopLossPct * 100).toFixed(2)}%`}
            mono
          />
          <StateDetailRow
            label={labels.takeProfit}
            value={`${(config.takeProfitPct * 100).toFixed(2)}%`}
            mono
          />
          <StateDetailRow
            label={labels.minProfit}
            value={`${(config.minProfitPct * 100).toFixed(2)}%`}
            mono
          />
          <StateDetailRow
            label={labels.maxCapital}
            value={`${(config.maxTradePct * 100).toFixed(0)}%`}
            mono
          />
          <StateDetailRow
            label={labels.simultaneousPositions}
            value={String(config.maxConcurrentPositions)}
            mono
          />
          <StateDetailRow
            label={labels.minInterval}
            value={`${config.minIntervalMinutes} min`}
            mono
          />
          <StateDetailRow
            label={labels.intervalMode}
            value={config.intervalMode}
          />
          {config.orderPriceOffsetPct !== 0 && (
            <StateDetailRow
              label={labels.priceOffset}
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
            title={labels.configUsedInLastDecision}
          />
          <div className="space-y-0">
            <StateDetailRow
              label={labels.buyThreshold}
              value={`${cfg.buyThreshold}%`}
              mono
            />
            <StateDetailRow
              label={labels.sellThreshold}
              value={`${cfg.sellThreshold}%`}
              mono
            />
            <StateDetailRow
              label={labels.stopLoss}
              value={`${(cfg.stopLossPct * 100).toFixed(2)}%`}
              mono
            />
            <StateDetailRow
              label={labels.takeProfit}
              value={`${(cfg.takeProfitPct * 100).toFixed(2)}%`}
              mono
            />
            <StateDetailRow
              label={labels.configUpdated}
              value={new Date(cfg.updatedAt).toLocaleDateString()}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <TabModal
      icon={Bot}
      title={config.name || `${config.asset}/${config.pair}`}
      subtitle={`${config.asset}/${config.pair} · ${labels.currentState}`}
      badgeHeader={config.mode}
      badgeHeaderClassName={modeColor}
      footerLabel={`${config.id.slice(0, 20)}…`}
      closeButton={{ label: labels.close, onClick: onClose }}
      onClose={onClose}
      tabs={[
        { icon: Activity, name: labels.tabStatus, content: estadoContent },
        {
          icon: BarChart3,
          name: labels.tabIndicators,
          content: indicadoresContent,
        },
        { icon: Newspaper, name: labels.tabNews, content: noticiasContent },
        {
          icon: SlidersHorizontal,
          name: labels.tabConfig,
          content: configContent,
        },
      ]}
    />
  );
}
