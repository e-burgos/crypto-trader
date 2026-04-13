import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createLLMProvider, LLMProviderClient } from '@crypto-trader/analysis';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { LLMProvider } from '@crypto-trader/shared';
import { RagService } from './rag.service';

export type SubAgentId =
  | 'platform'
  | 'operations'
  | 'market'
  | 'blockchain'
  | 'risk'
  | 'orchestrator';

export type AgentTask =
  | 'technical_signal'
  | 'news_sentiment'
  | 'sizing_suggestion'
  | 'risk_gate'
  | 'news_technical_relevance'
  | 'ecosystem_impact'
  | 'intent_classification'
  | 'decision_synthesis'
  | 'cross_agent_synthesis';

// ── Phase A: hardcoded system prompts (Phase B moves these to DB/seed) ───────

const AGENT_SYSTEM_PROMPTS: Record<SubAgentId, string> = {
  orchestrator: `Eres KRYPTO, el orquestador central de la plataforma CryptoTrader.
Tu único propósito es clasificar y enrutar; NUNCA das información directamente al usuario.

Para clasificación de intención, responde SOLO con JSON válido:
{ "agentId": "<platform|operations|market|blockchain|risk>", "confidence": 0.95, "reason": "...", "suggestedGreeting": "..." }

Para síntesis de decisiones de trading, responde SOLO con JSON válido:
{ "decision": "<BUY|SELL|HOLD>", "confidence": 0.0, "reasoning": "...", "waitMinutes": 15 }

Para síntesis cross-agente, produce una respuesta unificada e integradora.
Siempre responde en el idioma que el usuario usó.`,

  platform: `Eres NEXUS, el experto en la plataforma CryptoTrader.
Conoces cada rincón de CryptoTrader: cada parámetro, cada pantalla, cada decisión de diseño.
Tono: cálido, paciente y pedagógico. Jamás abrumador.
Scope: solo hablas de CryptoTrader. Si la consulta cruza a mercados, blockchain o DeFi puro, redirige al sub-agente adecuado de forma amigable.
Responde siempre en el idioma del usuario.`,

  operations: `Eres FORGE, el asistente de operaciones de CryptoTrader.
No analizo — actúo. Dame un objetivo y construimos el camino operativo para llegar.
Tono: directo, metódico, orientado a la acción.
IMPORTANTE: SIEMPRE confirmas antes de ejecutar cualquier operación de trading o configuración.
Para sugerencias de sizing, responde con JSON: { "recommendation": "proceed|skip", "maxTradeSize": 0.0, "reasoning": "..." }
Responde siempre en el idioma del usuario.`,

  market: `Eres SIGMA (Σ), el analista de mercado cuantitativo de CryptoTrader.
Leo el mercado en datos, no en opiniones. Cada señal tiene un número detrás.
Tono: frío, objetivo, cuantitativo. Siempre explica el razonamiento detrás de cada número.
Para señales técnicas, responde con JSON: { "signal": "BUY|SELL|HOLD", "confidence": 0.0, "reasoning": "..." }
Para sentimiento de noticias, responde con JSON: { "sentiment": 0.0, "impact": "positive|negative|neutral", "reasoning": "..." }
Para relevancia técnica de noticias, responde con JSON: { "relevance": 0.0, "affectedIndicators": [], "timeframe": "short|medium|long" }
Responde siempre en el idioma del usuario.`,

  blockchain: `Eres CIPHER, el experto en blockchain y ecosistema descentralizado de CryptoTrader.
Del bloque génesis al ZK-rollup, nada del ecosistema descentralizado es un misterio para ti.
Tono: intelectual, adaptable al nivel del usuario. Disfrutas la profundidad técnica.
Para impacto en ecosistema, responde con JSON: { "ecosystemImpact": "high|medium|low|none", "category": "...", "chains": [], "summary": "..." }
Responde siempre en el idioma del usuario.`,

  risk: `Eres AEGIS, el gestor de riesgo del portfolio en CryptoTrader.
Primero la supervivencia, después las ganancias.
Tono: conservador, cuantitativo, directo. Nunca dices "probablemente esté bien" — siempre cuantificas.
Para evaluaciones de riesgo, responde SOLO con JSON válido:
{ "riskScore": 0, "verdict": "PASS|REDUCE|BLOCK", "positionSizeMultiplier": 1.0, "reason": "...", "alerts": [] }
Reglas de veredicto:
- BLOCK si exposición a un solo activo supera el 50% del portfolio
- BLOCK si drawdown acumulado de la semana supera el umbral configurado
- REDUCE si el ratio riesgo/recompensa calculado es < 1.5
- PASS en cualquier otro caso
Responde siempre en el idioma del usuario.`,
};

// ── Task prompt builders ─────────────────────────────────────────────────────

function buildTaskUserPrompt(
  task: AgentTask,
  context: Record<string, unknown>,
): string {
  switch (task) {
    case 'technical_signal':
      return `Analiza este snapshot de indicadores y emite tu señal de trading:
${JSON.stringify(context.indicators, null, 2)}`;

    case 'news_sentiment':
      return `Analiza estas noticias y emite tu análisis de sentimiento del mercado:
${JSON.stringify(context.news, null, 2)}`;

    case 'sizing_suggestion':
      return `Configuración activa: ${JSON.stringify(context.config)}
Posiciones abiertas: ${context.openPositionsCount ?? 0}
¿Debería proceder con la operación? Dame tu sugerencia de sizing.`;

    case 'risk_gate':
      return `Portfolio actual del usuario:
${JSON.stringify(context.portfolio, null, 2)}
Snapshot de mercado:
Indicators summary: RSI=${(context.indicators as Record<string, unknown>)?.rsi ?? 'N/A'}, Price=${(context.indicators as Record<string, unknown>)?.price ?? 'N/A'}
Emite tu veredicto de riesgo en JSON.`;

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

    case 'decision_synthesis':
      return `Sintetiza estas 4 perspectivas de los sub-agentes y emite la decisión final de trading:

SIGMA (Señal técnica): ${context.technicalSignal}
SIGMA (Sentimiento noticias): ${context.newsSentiment}
FORGE (Sizing): ${context.sizingSuggestion}
AEGIS (Riesgo): ${context.aegisVerdict}

Config del usuario: buyThreshold=${context.buyThreshold}%, sellThreshold=${context.sellThreshold}%
Emite el JSON de decisión final.`;

    case 'cross_agent_synthesis':
      return `Sintetiza estas perspectivas de múltiples sub-agentes en una respuesta unificada:
${(context.responses as Array<{ agentId: string; response: string }>)
  ?.map((r) => `${r.agentId.toUpperCase()}: ${r.response}`)
  .join('\n\n')}

Consulta original del usuario: "${context.originalQuery}"`;

    default:
      return JSON.stringify(context);
  }
}

// ── SubAgentService ──────────────────────────────────────────────────────────

@Injectable()
export class SubAgentService {
  private readonly logger = new Logger(SubAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly ragService?: RagService,
  ) {}

  /**
   * Resolves the system prompt for an agent.
   * Phase B: reads from DB (AgentDefinition) with fallback to hardcoded prompts.
   */
  private async resolveSystemPrompt(agentId: SubAgentId): Promise<string> {
    try {
      const definition = await this.prisma.agentDefinition.findUnique({
        where: { id: agentId as any },
        select: { systemPrompt: true, isActive: true },
      });
      if (definition?.isActive && definition.systemPrompt) {
        return definition.systemPrompt;
      }
    } catch {
      // DB not available yet (migration pending) — use hardcoded
    }
    return AGENT_SYSTEM_PROMPTS[agentId];
  }

  /**
   * Synchronous LLM call to a specific sub-agent.
   * Returns raw text response (caller is responsible for JSON parsing).
   * Phase B: injects RAG context into system prompt when userMessage is provided.
   */
  async call(
    agentId: SubAgentId,
    task: AgentTask,
    context: Record<string, unknown>,
    userId: string,
    /** Prefer cheap model for lightweight tasks (classification, enrichment) */
    preferCheap = false,
  ): Promise<string> {
    const provider = await this.getProvider(userId, preferCheap);
    let systemPrompt = await this.resolveSystemPrompt(agentId);

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
      return await provider.complete(systemPrompt, userPrompt);
    } catch (err) {
      this.logger.warn(
        `SubAgent[${agentId}] task=${task} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  /**
   * Get an LLMProviderClient from the user's active credentials.
   * If preferCheap=true, prefers Groq (cheapest); otherwise uses most recent active cred.
   */
  async getProvider(
    userId: string,
    preferCheap = false,
  ): Promise<LLMProviderClient> {
    let cred = null;

    if (preferCheap) {
      cred = await this.prisma.lLMCredential.findFirst({
        where: { userId, provider: LLMProvider.GROQ, isActive: true },
      });
      if (!cred) {
        cred = await this.prisma.lLMCredential.findFirst({
          where: { userId, provider: LLMProvider.OPENAI, isActive: true },
        });
      }
    }

    if (!cred) {
      cred = await this.prisma.lLMCredential.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!cred) {
      throw new Error(
        `No active LLM credentials for user ${userId}. Configure them in Settings.`,
      );
    }

    const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
    return createLLMProvider(
      cred.provider as LLMProvider,
      apiKey,
      cred.selectedModel,
    );
  }
}
