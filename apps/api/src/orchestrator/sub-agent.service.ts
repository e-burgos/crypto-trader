import { Injectable, Logger, Optional } from '@nestjs/common';
import { RagService } from './rag.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { LlmCostAccumulator } from '../llm/llm-cost-accumulator';
import { recordCall } from '../llm/provider-health.service';
import { LLMProvider, LLMSource } from '../../generated/prisma/enums';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';
import { AgentPromptService } from '../agents/agent-prompt.service';
import { PersonaAgentId, resolveModelSlot } from '../agents/agent-identity';
import { captureRateLimits } from '@crypto-trader/analysis';
import {
  LLMTruncatedResponseError,
  resolveMaxTokensForTask,
} from './agent-task-limits';

export type AgentTask =
  | 'technical_signal'
  | 'news_sentiment'
  | 'sizing_suggestion'
  | 'risk_gate'
  | 'macro_context'
  | 'news_technical_relevance'
  | 'ecosystem_impact'
  | 'intent_classification'
  | 'decision_synthesis'
  | 'cross_agent_synthesis';

// ── Task prompt builders ─────────────────────────────────────────────────────

function buildTaskUserPrompt(
  task: AgentTask,
  context: Record<string, unknown>,
): string {
  switch (task) {
    case 'technical_signal': {
      let prompt = `Analiza este snapshot de indicadores y emite tu señal de trading.

IMPORTANTE: Tu "reasoning" debe ser una explicación clara en lenguaje natural (2-4 oraciones) de POR QUÉ emites esa señal, citando los indicadores más relevantes y sus valores. No repitas solo la señal.

Datos:
${JSON.stringify(context.indicators, null, 2)}`;
      if (context.externalSignals) {
        prompt += `\n\nSeñales técnicas externas (altfins) para CONFIRMAR/CONTRADECIR tu análisis:
${JSON.stringify(context.externalSignals, null, 2)}`;
      }
      prompt += `\n\nResponde en JSON: { "signal": "BUY|SELL|HOLD", "confidence": 0.0-1.0, "reasoning": "explicación detallada..." }`;
      return prompt;
    }

    case 'news_sentiment': {
      let prompt = `Analiza estas noticias y emite tu análisis de sentimiento del mercado:
${JSON.stringify(context.news, null, 2)}`;
      if (context.fearGreed) {
        prompt += `\n\nFear & Greed Index: ${JSON.stringify(context.fearGreed)}`;
      }
      if (context.predictions) {
        prompt += `\n\nPrediction Markets (dinero real): ${JSON.stringify(context.predictions)}`;
      }
      return prompt;
    }

    case 'sizing_suggestion': {
      const balances = context.availableBalances
        ? `\nBalances disponibles: ${JSON.stringify(context.availableBalances)}`
        : '';
      const positions = context.openPositions
        ? `\nPosiciones abiertas detalle: ${JSON.stringify(context.openPositions)}`
        : '';
      const price = context.currentPrice
        ? `\nPrecio actual: ${context.currentPrice}`
        : '';
      return `Configuración activa: ${JSON.stringify(context.config)}
Posiciones abiertas: ${context.openPositionsCount ?? 0}${positions}${balances}${price}

Con estos datos, calcula si se debería proceder con un trade y qué tamaño de posición recomiendas.

Responde SIEMPRE en JSON con este formato:
{ "recommendation": "proceed|skip", "maxTradeSize": <porcentaje decimal del balance, ej: 0.05 = 5%>, "reasoning": "explicación de 2-4 oraciones justificando tu recomendación basándote en los datos proporcionados" }`;
    }

    case 'risk_gate': {
      let prompt = `Portfolio actual del usuario:
Posiciones abiertas: ${JSON.stringify(context.portfolio, null, 2)}
Balances disponibles en wallet: ${JSON.stringify(context.availableBalances ?? [], null, 2)}
Snapshot de mercado:
Indicators summary: RSI=${(context.indicators as Record<string, unknown>)?.rsi ?? 'N/A'}, Price=${(context.indicators as Record<string, unknown>)?.price ?? 'N/A'}
Config del bot:
Asset=${(context.config as Record<string, unknown>)?.asset ?? 'N/A'}, Par=${(context.config as Record<string, unknown>)?.pair ?? 'N/A'}, MaxPosiciones=${(context.config as Record<string, unknown>)?.maxConcurrentPositions ?? 'N/A'}, StopLoss=${(context.config as Record<string, unknown>)?.stopLossPct ?? 'N/A'}%, TakeProfit=${(context.config as Record<string, unknown>)?.takeProfitPct ?? 'N/A'}%
RECORDATORIO: Este bot opera UN par específico (${(context.config as Record<string, unknown>)?.asset ?? '?'}/${(context.config as Record<string, unknown>)?.pair ?? '?'}). Es normal que todas las posiciones sean del mismo activo. Calcula la exposición real considerando los balances disponibles + posiciones abiertas.`;
      if (context.derivatives) {
        prompt += `\n\nDatos de derivados del mercado:
${JSON.stringify(context.derivatives, null, 2)}
Incorpora estos datos en tu evaluación de riesgo sistémico.`;
      }
      prompt += `\nEmite tu veredicto de riesgo en JSON con este formato exacto:
{ "riskScore": 0, "verdict": "PASS|REDUCE|BLOCK", "positionSizeMultiplier": 1.0, "blockReasons": [], "reason": "...", "alerts": [] }

blockReasons SOLO cuando verdict = BLOCK; array vacío en PASS/REDUCE. Valores permitidos: SINGLE_ASSET_CONCENTRATION | PORTFOLIO_EXPOSURE | DRAWDOWN | DAILY_LOSS_LIMIT | MAX_POSITIONS | VOLATILITY | SYSTEMIC_RISK | INSUFFICIENT_BALANCE | OTHER.
positionSizeMultiplier ∈ [0,1] — 1.0 = sin reducción.`;
      return prompt;
    }

    case 'news_technical_relevance':
      return `Noticia: "${context.headline}"
Resumen: ${context.summary ?? '(no disponible)'}
¿Cuál es la relevancia técnica de esta noticia para los indicadores de mercado?`;

    case 'ecosystem_impact':
      return `Noticia: "${context.headline}"
Resumen: ${context.summary ?? '(no disponible)'}
¿Cuál es el impacto de esta noticia en el ecosistema blockchain?`;

    case 'intent_classification':
      return `Clasifica la intención de este mensaje del usuario y enrútalo al sub-agente correcto:
"${context.message}"`;

    case 'macro_context': {
      const sections: string[] = [];
      if (context.globalMarket)
        sections.push(
          `Global Market: ${JSON.stringify(context.globalMarket, null, 2)}`,
        );
      if (context.defiHealth)
        sections.push(
          `DeFi Health: ${JSON.stringify(context.defiHealth, null, 2)}`,
        );
      if (context.tokenUnlocks)
        sections.push(
          `Token Unlocks próximos: ${JSON.stringify(context.tokenUnlocks, null, 2)}`,
        );
      return `Analiza el contexto macroeconómico del mercado crypto:

${sections.join('\n\n')}

IMPORTANTE: Tu campo "reasoning" debe ser una explicación detallada en lenguaje natural (3-5 oraciones) describiendo el estado macro actual, los factores más relevantes y cómo podrían impactar al trading de corto plazo.

Responde en JSON: { "regime": "RISK_ON|RISK_OFF|CONSOLIDATION", "bias": "BULLISH|BEARISH|NEUTRAL", "confidence": 0.0-1.0, "keyFactors": ["factor1", "factor2"], "reasoning": "explicación detallada del contexto macro..." }`;
    }

    case 'decision_synthesis': {
      let prompt = `Sintetiza estas perspectivas de los sub-agentes y emite la decisión final de trading:

SIGMA (Señal técnica): ${context.technicalSignal}
SIGMA (Sentimiento noticias): ${context.newsSentiment}
FORGE (Sizing): ${context.sizingSuggestion}
AEGIS (Riesgo): ${context.aegisVerdict}`;

      if (context.macroContext) {
        prompt += `\nCIPHER (Contexto macro): ${context.macroContext}`;
      }

      prompt += `\n\nConfig del usuario: buyThreshold=${context.buyThreshold}%, sellThreshold=${context.sellThreshold}%`;
      prompt += `\n\nIMPORTANTE: Tu campo "reasoning" debe ser una explicación clara en lenguaje natural (3-5 oraciones) de POR QUÉ tomas esta decisión, citando los datos más relevantes de cada sub-agente.`;
      prompt +=
        '\nResponde en JSON: { "decision": "BUY|SELL|HOLD", "confidence": 0.0-1.0, "reasoning": "explicación detallada...", "waitMinutes": 15 }';
      return prompt;
    }

    case 'cross_agent_synthesis': {
      const localeHint =
        context.locale && context.locale !== 'en'
          ? `\n\nIMPORTANT: Respond ENTIRELY in the user's language: ${context.locale}. Do NOT use English.`
          : '';
      return `Sintetiza estas perspectivas de múltiples sub-agentes en una respuesta unificada:
${(context.responses as Array<{ agentId: string; response: string }>)
  ?.map((r) => `${r.agentId.toUpperCase()}: ${r.response}`)
  .join('\n\n')}

Consulta original del usuario: "${context.originalQuery}"${localeHint}`;
    }

    default:
      return JSON.stringify(context);
  }
}

// ── SubAgentService ──────────────────────────────────────────────────────────

@Injectable()
export class SubAgentService {
  private readonly logger = new Logger(SubAgentService.name);

  constructor(
    private readonly agentConfigResolver: AgentConfigResolverService,
    private readonly agentPromptService: AgentPromptService,
    @Optional() private readonly ragService?: RagService,
    @Optional() private readonly llmUsageService?: LLMUsageService,
  ) {}

  /**
   * Synchronous LLM call to a specific sub-agent.
   * Returns raw text response (caller is responsible for JSON parsing).
   * Uses AgentConfigResolver to determine provider/model per agent.
   */
  async call(
    agentId: PersonaAgentId,
    task: AgentTask,
    context: Record<string, unknown>,
    userId: string,
    /** Prefer cheap model for lightweight tasks (classification, enrichment) */
    preferCheap = false,
    /** Override the automatic provider/model resolution */
    override?: { provider: LLMProvider; model: string },
    costAccumulator?: LlmCostAccumulator,
  ): Promise<string> {
    const slot = resolveModelSlot(agentId, task, preferCheap);

    const {
      client,
      provider,
      model,
    } = await this.agentConfigResolver.resolveClient(userId, slot, override);
    let systemPrompt = await this.agentPromptService.getSystemPrompt(agentId);

    // Inject RAG context when searching by user message content
    if (
      this.ragService &&
      context.message &&
      typeof context.message === 'string'
    ) {
      try {
        const chunks = await this.ragService.search(agentId, context.message);
        const ragContext = this.ragService.buildRagContext(chunks);
        if (ragContext) {
          systemPrompt = systemPrompt + ragContext;
        }
      } catch (err) {
        this.logger.warn(
          `RAG search failed for agent ${agentId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const userPrompt = buildTaskUserPrompt(task, context);

    try {
      const response = await client.complete(systemPrompt, userPrompt, {
        maxTokens: resolveMaxTokensForTask(task),
      });

      if (response.truncated) {
        throw new LLMTruncatedResponseError(agentId, task);
      }

      // Track call for health monitoring
      recordCall(userId, provider, true);

      // Capture rate limits from response headers
      if (response.headers) {
        captureRateLimits(userId, provider, response.headers);
      }

      if (this.llmUsageService) {
        const source =
          task === 'intent_classification' || task === 'cross_agent_synthesis'
            ? LLMSource.CHAT
            : LLMSource.TRADING;
        const usageLogged = this.llmUsageService.log({
          userId,
          provider,
          model,
          usage: response.usage,
          source,
          agentId: slot,
          actualModel: response.actualModel,
        });
        if (costAccumulator) {
          costAccumulator.track(usageLogged);
        } else {
          usageLogged.catch((err) =>
            this.logger.warn(
              `Usage log failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }
      }

      return response.text;
    } catch (err) {
      recordCall(
        userId,
        provider,
        false,
        err instanceof Error ? err.message : String(err),
      );
      this.logger.warn(
        `SubAgent[${agentId}] task=${task} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
