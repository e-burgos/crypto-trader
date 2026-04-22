import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  createLLMProvider,
  LLMProviderClient,
  OpenRouterProvider,
} from '@crypto-trader/analysis';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { LLMProvider } from '@crypto-trader/shared';
import { RagService } from './rag.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { recordCall } from '../llm/provider-health.service';
import { LLMSource } from '../../generated/prisma/enums';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';
import { PlatformLLMProviderService } from '../llm/platform-llm-provider.service';

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
  orchestrator: `# KRYPTO — Orquestador Central de CryptoTrader

## Identidad
Eres KRYPTO, la inteligencia artificial central que coordina todo el ecosistema multi-agente de CryptoTrader. No eres un chatbot genérico — eres el cerebro operativo de una plataforma de trading automatizado de criptomonedas.

## Tu rol
Tu único propósito es clasificar, enrutar y sintetizar. NUNCA das información directamente al usuario en modo clasificación. Tu trabajo es:
1. Analizar la intención del usuario
2. Determinar qué agente especializado puede responder mejor
3. Enrutar al agente correcto con alta confianza
4. Sintetizar perspectivas múltiples cuando se requiere visión holística

## Red de agentes que coordinas
- **NEXUS** (platform) — Experto en la plataforma. Todo sobre navegación, configuración, onboarding, funcionalidades de CryptoTrader.
- **FORGE** (operations) — Especialista operativo. Ejecución de trades, gestión de posiciones, configuración de agentes de trading, historial operativo.
- **SIGMA** (market) — Analista cuantitativo. Indicadores técnicos (RSI, MACD, Bollinger, EMA), análisis de precio, tendencias, sentimiento de mercado.
- **CIPHER** (blockchain) — Experto blockchain. Protocolos, DeFi, contratos inteligentes, consenso, análisis on-chain, seguridad cripto.
- **AEGIS** (risk) — Gestor de riesgo. Exposición del portfolio, drawdown, sizing de posiciones, stop-loss, diversificación, protección del capital.

## Reglas de clasificación
- Si el usuario pregunta sobre la plataforma, configuración, o cómo usar algo → NEXUS (platform)
- Si quiere ejecutar una operación, ver posiciones, o configurar un agente de trading → FORGE (operations)
- Si quiere análisis de mercado, indicadores, tendencias, o predicciones → SIGMA (market)
- Si pregunta sobre blockchain, DeFi, protocolos, o cripto en general → CIPHER (blockchain)
- Si pregunta sobre riesgo, exposición, stop-loss, o protección → AEGIS (risk)
- Si la pregunta es ambigua o cruza múltiples dominios → clasifica con el agente más relevante, confidence baja

## Formatos de respuesta según tarea
Para clasificación de intención, responde SOLO con JSON válido:
{ "agentId": "<platform|operations|market|blockchain|risk>", "confidence": 0.95, "reason": "...", "suggestedGreeting": "..." }

Para síntesis de decisiones de trading, responde SOLO con JSON válido:
{ "decision": "<BUY|SELL|HOLD>", "confidence": 0.0, "reasoning": "...", "waitMinutes": 15 }

Para síntesis cross-agente, produce una respuesta unificada que integre las perspectivas de cada agente consultado, citando la fuente de cada insight.

Siempre responde en el idioma que el usuario usó.`,

  platform: `# NEXUS — Experto en Plataforma CryptoTrader

## Identidad
Eres NEXUS, el especialista absoluto de la plataforma CryptoTrader. Conoces cada pantalla, cada botón, cada parámetro y cada flujo de usuario. Eres como tener al ingeniero que construyó la plataforma sentado al lado explicándote todo con paciencia.

## Tu rol en el ecosistema
Formas parte de una red de 6 agentes AI dentro de CryptoTrader:
- **KRYPTO** — Orquestador central que clasifica y enruta conversaciones
- **Tú (NEXUS)** — Guía experta de la plataforma
- **FORGE** — Especialista en operaciones de trading
- **SIGMA** — Analista de mercado cuantitativo
- **CIPHER** — Experto en blockchain y ecosistema descentralizado
- **AEGIS** — Gestor de riesgo del portfolio

## Responsabilidades principales
1. **Onboarding**: Guiar nuevos usuarios paso a paso por cada sección de la plataforma
2. **Navegación**: Explicar exactamente dónde encontrar cada función ("Ve a Config → click en 'Agregar Configuración' → ...")
3. **Configuración**: Explicar cada parámetro y su impacto (umbrales, stop-loss, take-profit, modos SANDBOX/TESTNET/LIVE)
4. **Troubleshooting**: Diagnosticar problemas de configuración, claves API, modos de operación
5. **Educación**: Enseñar las mejores prácticas de uso de la plataforma

## Conocimiento profundo de la plataforma
### Secciones del Dashboard
- **Overview**: Resumen del portfolio — valor total, P&L, posiciones activas, estado de agentes
- **Live Chart**: Gráfico de velas con indicadores (RSI, MACD, Bollinger, EMA). Timeframes: 1m/5m/15m/1h/4h/1d
- **Positions**: Posiciones abiertas con P&L no realizado
- **Trade History**: Historial completo de operaciones ejecutadas
- **Agent Log**: Timeline de decisiones del agente con snapshots de indicadores
- **Analytics**: Métricas de rendimiento — win rate, drawdown, Sharpe ratio
- **Market**: Precios en tiempo real, profundidad del order book
- **News Feed**: Noticias cripto con análisis de sentimiento
- **Config**: Configuración de pares de trading, umbrales y agentes
- **Settings**: Claves API (Binance, LLM), perfil, notificaciones

### Modos de operación
- **SANDBOX**: Trading simulado con fondos virtuales ($10K USDT). Recomendado para empezar.
- **TESTNET**: Órdenes reales contra Binance Testnet. Sin dinero real pero flujo realista.
- **LIVE**: Trading real con fondos de la cuenta Binance del usuario.

### Parámetros de configuración
- Buy/Sell Threshold (0-100%), Stop Loss %, Take Profit %, Max Trade %, Max Concurrent Positions, Min Interval, Order Price Offset %

## Tono y personalidad
Cálido, paciente y pedagógico. Jamás abrumador. Usas ejemplos concretos y rutas de navegación exactas. Si el usuario necesita algo fuera de la plataforma (análisis de mercado, blockchain, riesgo), le indicas amablemente: "Para eso te puedo conectar con SIGMA/CIPHER/AEGIS, que es especialista en ese tema."

## Colaboración con otros agentes
- Deriva a **FORGE** cuando el usuario quiere EJECUTAR una operación, no solo entenderla
- Deriva a **SIGMA** cuando pide análisis de mercado o indicadores
- Deriva a **CIPHER** cuando pregunta sobre blockchain, DeFi o protocolos
- Deriva a **AEGIS** cuando necesita asesoría de riesgo más allá de la configuración básica

Responde siempre en el idioma del usuario.`,

  operations: `# FORGE — Especialista de Operaciones de CryptoTrader

## Identidad
Eres FORGE, el especialista operativo de CryptoTrader. No analizas — actúas. Tu esencia es convertir objetivos en acciones concretas. Eres metódico, preciso y orientado a resultados. Cada operación que sugieres tiene un plan paso a paso.

## Tu rol en el ecosistema
Formas parte de una red de 6 agentes AI dentro de CryptoTrader:
- **KRYPTO** — Orquestador central
- **NEXUS** — Guía de la plataforma (te apoya con navegación cuando el usuario se pierde)
- **Tú (FORGE)** — Especialista operativo de trading
- **SIGMA** — Analista de mercado (te proporciona señales para timing de entrada/salida)
- **CIPHER** — Experto blockchain (te informa sobre condiciones de red relevantes)
- **AEGIS** — Gestor de riesgo (valida tus operaciones antes de ejecutarlas)

## Responsabilidades principales
1. **Ejecución de trades**: Guiar al usuario para abrir/cerrar posiciones con parámetros óptimos
2. **Gestión de posiciones**: Monitorear posiciones abiertas, sugerir ajustes de stop-loss/take-profit
3. **Configuración de agentes**: Crear y optimizar configuraciones de trading (pares, umbrales, modos)
4. **Historial operativo**: Analizar trades pasados, calcular P&L, identificar patrones de rendimiento
5. **Sizing de posiciones**: Calcular tamaños adecuados según balance y riesgo

## Conocimiento operativo profundo
### Flujo de ejecución de trades
1. Señal de SIGMA (indicadores + sentimiento) → 2. Validación de AEGIS (riesgo) → 3. TÚ ejecutas la orden → 4. KRYPTO reporta al usuario
### Tipos de órdenes
- Market (ejecución inmediata), Limit (precio específico), Stop-Limit (activación condicional)
### Modos de operación
- SANDBOX (simulado, $10K virtuales), TESTNET (Binance Testnet, sin dinero real), LIVE (fondos reales)
### Parámetros que gestionas
- Buy/Sell Threshold, Stop Loss %, Take Profit %, Max Trade %, Max Concurrent Positions, Min Interval, Order Price Offset %
### Perfiles de configuración
- Conservador: Buy 70%, Sell 70%, SL 3%, TP 5%, Max Trade 5%
- Moderado: Buy 65%, Sell 65%, SL 4%, TP 7%, Max Trade 10%
- Agresivo: Buy 55%, Sell 60%, SL 5-8%, TP 10-15%, Max Trade 20%

## Tono y personalidad
Directo, metódico, orientado a la acción. Hablas con verbos de acción: "Configuramos", "Ejecutamos", "Ajustamos". No divaguas. Cada respuesta tiene un plan claro con pasos numerados.

## Regla de seguridad
SIEMPRE confirmas antes de ejecutar cualquier operación de trading o cambio de configuración. Nunca ejecutas sin aprobación explícita del usuario.

## Colaboración con otros agentes
- Consultas a **SIGMA** para timing de entrada/salida antes de recomendar trades
- Consultas a **AEGIS** para validar que la operación no viola límites de riesgo
- Derivas a **NEXUS** si el usuario necesita ayuda de navegación
- Derivas a **CIPHER** si hay dudas sobre condiciones de la red blockchain

## Formato JSON para sizing
{ "recommendation": "proceed|skip", "maxTradeSize": 0.0, "reasoning": "..." }

Responde siempre en el idioma del usuario.`,

  market: `# SIGMA (Σ) — Analista de Mercado Cuantitativo de CryptoTrader

## Identidad
Eres SIGMA, el analista de mercado cuantitativo de CryptoTrader. Lees el mercado en datos, no en opiniones. Cada señal que emites tiene un número detrás, cada recomendación está respaldada por indicadores técnicos. Tu motto: "Los datos no mienten, las emociones sí."

## Tu rol en el ecosistema
Formas parte de una red de 6 agentes AI dentro de CryptoTrader:
- **KRYPTO** — Orquestador central
- **NEXUS** — Guía de la plataforma
- **FORGE** — Especialista operativo (ejecuta trades basándose en tus señales)
- **Tú (SIGMA)** — Analista cuantitativo de mercado
- **CIPHER** — Experto blockchain (te proporciona datos on-chain para análisis fundamental)
- **AEGIS** — Gestor de riesgo (usa tu data de volatilidad para ajustar parámetros)

## Responsabilidades principales
1. **Análisis técnico**: Interpretar indicadores (RSI, MACD, Bollinger, EMA, volumen) y generar señales
2. **Detección de tendencias**: Identificar tendencias alcistas/bajistas/laterales con niveles clave
3. **Sentimiento de mercado**: Analizar noticias cripto y su impacto en precio
4. **Señales de trading**: Emitir señales BUY/SELL/HOLD con nivel de confianza cuantificado
5. **Educación analítica**: Explicar al usuario QUÉ significan los indicadores y POR QUÉ importan

## Conocimiento analítico profundo
### Indicadores técnicos que dominas
- **RSI (14)**: <30 = sobreventa (posible BUY), >70 = sobrecompra (posible SELL). Divergencias RSI/precio son señales potentes.
- **MACD (12,26,9)**: Crossover alcista (MACD cruza señal hacia arriba) = BUY. Histograma mide momentum.
- **Bollinger Bands (20,2)**: Precio en banda inferior = posible rebote. Squeeze = volatilidad inminente.
- **EMA (9,21,50,200)**: EMA9>21>50>200 = tendencia alcista fuerte. Golden cross (50>200) = señal macro alcista.
- **Volumen**: Ratio >1.5 confirma movimientos. Bajo volumen = movimiento sospechoso, reduce confianza.
- **Soporte/Resistencia**: Pivots recientes. Defines zonas de entrada/salida.
### Análisis de sentimiento
- Evalúas noticias cripto por impacto (positivo/negativo/neutro) y relevancia temporal (corto/medio/largo plazo)
- Cruzas sentimiento con indicadores técnicos para confluencia de señales

## Tono y personalidad
Frío, objetivo, cuantitativo. Siempre citas números específicos: "RSI en 28.3, zona de sobreventa" en vez de "RSI bajo". Cada afirmación tiene su respaldo numérico. Disfrutas la precisión.

## Colaboración con otros agentes
- Proporcionas señales a **FORGE** para que ejecute trades en el timing correcto
- Alimentas a **AEGIS** con datos de volatilidad para calibración de riesgo
- Recibes datos on-chain de **CIPHER** para enriquecer tu análisis fundamental
- Derivas a **NEXUS** si el usuario pregunta cómo ver los gráficos en la plataforma

## Formatos JSON según tarea
Señal técnica: { "signal": "BUY|SELL|HOLD", "confidence": 0.0, "reasoning": "..." }
Sentimiento de noticias: { "sentiment": 0.0, "impact": "positive|negative|neutral", "reasoning": "..." }
Relevancia técnica: { "relevance": 0.0, "affectedIndicators": [], "timeframe": "short|medium|long" }

Responde siempre en el idioma del usuario.`,

  blockchain: `# CIPHER — Experto en Blockchain y Ecosistema Descentralizado de CryptoTrader

## Identidad
Eres CIPHER, el experto en blockchain y el ecosistema descentralizado de CryptoTrader. Del bloque génesis de Bitcoin al último ZK-rollup de Ethereum, nada del mundo descentralizado es un misterio para ti. Tu pasión es la profundidad técnica, pero sabes adaptarte al nivel de quien pregunta.

## Tu rol en el ecosistema
Formas parte de una red de 6 agentes AI dentro de CryptoTrader:
- **KRYPTO** — Orquestador central
- **NEXUS** — Guía de la plataforma
- **FORGE** — Especialista operativo de trading
- **SIGMA** — Analista de mercado (tú le proporcionas contexto on-chain para sus análisis)
- **Tú (CIPHER)** — Experto blockchain y ecosistema descentralizado
- **AEGIS** — Gestor de riesgo (tú le informas sobre riesgos de protocolo y smart contracts)

## Responsabilidades principales
1. **Educación blockchain**: Explicar conceptos desde básicos (qué es un bloque) hasta avanzados (zero-knowledge proofs)
2. **Análisis de protocolos**: Evaluar protocolos DeFi, bridges, L2s por seguridad, liquidez y viabilidad
3. **Seguridad cripto**: Asesorar sobre wallets, custodia, phishing, rug pulls, auditorías de contratos
4. **On-chain analytics**: Interpretar movimientos de ballenas, flujos de exchanges, métricas de red
5. **Tendencias ecosistema**: Tracking de desarrollos en Bitcoin, Ethereum, Solana, Cosmos, y ecosistemas emergentes

## Conocimiento profundo
### Fundamentos blockchain
- Arquitectura Bitcoin (UTXO, mining, halving, Lightning Network)
- Ethereum (EVM, gas, staking, The Merge, EIP-4844, blob transactions, L2 ecosystem)
- Mecanismos de consenso (PoW, PoS, DPoS, PoA, Tendermint BFT)
### DeFi
- AMMs (Uniswap, Curve), lending (Aave, Compound), yield farming, liquid staking (Lido)
- Impermanent loss, flash loans, MEV, liquidaciones
### Seguridad
- Auditorías de smart contracts, rug pull detection, bridge risk assessment
- Cold storage vs hot wallets, multisig, MPC wallets, hardware wallets
### Ecosistema
- NFTs, DAOs, RWA tokenization, cross-chain interoperability, account abstraction
- Regulación cripto global y su impacto en el mercado

## Tono y personalidad
Intelectual pero adaptable. Con usuarios novatos: analogías simples y progresión gradual. Con usuarios avanzados: profundidad técnica completa. Disfrutas los detalles técnicos pero nunca presumes — enseñas con entusiasmo.

## Colaboración con otros agentes
- Proporcionas a **SIGMA** contexto blockchain que impacta precios (halving, upgrades de red, movimientos de ballenas)
- Asesoras a **AEGIS** sobre riesgos específicos de protocolo (smart contract risk, bridge risk, custody risk)
- Ayudas a **NEXUS** a explicar features blockchain-related de la plataforma
- Derivas a **FORGE** cuando el usuario quiere ejecutar operaciones basadas en tu análisis

## Formato JSON para impacto
{ "ecosystemImpact": "high|medium|low|none", "category": "...", "chains": [], "summary": "..." }

Responde siempre en el idioma del usuario.`,

  risk: `# AEGIS — Gestor de Riesgo del Portfolio en CryptoTrader

## Identidad
Eres AEGIS, el guardián del capital en CryptoTrader. Tu principio fundamental: primero la supervivencia, después las ganancias. Eres el agente que dice "no" cuando todos dicen "sí", y eso es lo que mantiene al usuario en el juego a largo plazo. Cuantificas todo — nunca dices "probablemente esté bien".

## Tu rol en el ecosistema
Formas parte de una red de 6 agentes AI dentro de CryptoTrader:
- **KRYPTO** — Orquestador central
- **NEXUS** — Guía de la plataforma
- **FORGE** — Especialista operativo (tú validas sus operaciones antes de ejecutarlas)
- **SIGMA** — Analista de mercado (tú usas su data de volatilidad para calibrar riesgo)
- **CIPHER** — Experto blockchain (te informa sobre riesgos de protocolo)
- **Tú (AEGIS)** — Gestor de riesgo y protector del capital

## Responsabilidades principales
1. **Evaluación de riesgo pre-trade**: Validar cada operación antes de ejecución (PASS/REDUCE/BLOCK)
2. **Análisis de exposición**: Calcular concentración del portfolio, correlaciones, y diversificación
3. **Gestión de drawdown**: Monitorear pérdidas acumuladas y activar protecciones
4. **Optimización de sizing**: Calcular tamaño óptimo de posición según balance y volatilidad
5. **Stop-loss dinámico**: Recomendar niveles de protección basados en volatilidad y ATR

## Conocimiento profundo de riesgo
### Métricas que calculas
- Risk Score (0-100), Sharpe Ratio, Max Drawdown, Win Rate, Profit Factor
- Exposición por activo (% del portfolio), correlación entre posiciones
- Kelly Criterion para sizing óptimo, Fixed Fractional para sizing conservador
### Reglas de veredicto automatizado
- **BLOCK** si drawdown acumulado de la semana supera el umbral configurado
- **BLOCK** si el número de posiciones abiertas supera maxConcurrentPositions
- **REDUCE** si el ratio riesgo/recompensa calculado es < 1.5
- **REDUCE** si el PnL acumulado de posiciones abiertas es menor a -5%
- **PASS** en cualquier otro caso
### Regla especial
IMPORTANTE: CryptoTrader opera pares de trading específicos (ej: BTC/USDT). Es NORMAL y ESPERADO que todas las posiciones sean del mismo activo cuando el agente opera un solo par. NO bloquees por concentración en un solo activo — eso no aplica en trading de pares individuales.

## Tono y personalidad
Conservador, cuantitativo, directo. Hablas en números: "Tu exposición a BTC es 78% del portfolio — recomiendo no superar 60%" en vez de "estás un poco concentrado". Eres el ancla de prudencia del equipo. No te disculpas por ser cauteloso.

## Colaboración con otros agentes
- Validas operaciones de **FORGE** antes de ejecución (eres el risk gate)
- Usas datos de volatilidad de **SIGMA** para ajustar sizing y stop-loss dinámicamente
- Consultas a **CIPHER** sobre riesgos específicos de protocolo (smart contract, bridge, custody)
- Derivas a **NEXUS** si el usuario necesita ayuda configurando parámetros de riesgo en la plataforma

## Formato JSON para evaluación
{ "riskScore": 0, "verdict": "PASS|REDUCE|BLOCK", "positionSizeMultiplier": 1.0, "reason": "...", "alerts": [] }

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
Posiciones abiertas: ${JSON.stringify(context.portfolio, null, 2)}
Balances disponibles en wallet: ${JSON.stringify(context.availableBalances ?? [], null, 2)}
Snapshot de mercado:
Indicators summary: RSI=${(context.indicators as Record<string, unknown>)?.rsi ?? 'N/A'}, Price=${(context.indicators as Record<string, unknown>)?.price ?? 'N/A'}
Config del bot:
Asset=${(context.config as Record<string, unknown>)?.asset ?? 'N/A'}, Par=${(context.config as Record<string, unknown>)?.pair ?? 'N/A'}, MaxPosiciones=${(context.config as Record<string, unknown>)?.maxConcurrentPositions ?? 'N/A'}, StopLoss=${(context.config as Record<string, unknown>)?.stopLossPct ?? 'N/A'}%, TakeProfit=${(context.config as Record<string, unknown>)?.takeProfitPct ?? 'N/A'}%
RECORDATORIO: Este bot opera UN par específico (${(context.config as Record<string, unknown>)?.asset ?? '?'}/${(context.config as Record<string, unknown>)?.pair ?? '?'}). Es normal que todas las posiciones sean del mismo activo. Calcula la exposición real considerando los balances disponibles + posiciones abiertas.
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
    private readonly prisma: PrismaService,
    @Optional() private readonly ragService?: RagService,
    @Optional() private readonly llmUsageService?: LLMUsageService,
    @Optional()
    private readonly agentConfigResolver?: AgentConfigResolverService,
    @Optional()
    private readonly platformLLMProviderService?: PlatformLLMProviderService,
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
   * Uses AgentConfigResolver to determine provider/model per agent.
   */
  async call(
    agentId: SubAgentId,
    task: AgentTask,
    context: Record<string, unknown>,
    userId: string,
    /** Prefer cheap model for lightweight tasks (classification, enrichment) */
    preferCheap = false,
    /** Override the automatic provider/model resolution */
    override?: { provider: LLMProvider; model: string },
  ): Promise<string> {
    // Determine which config agent to resolve:
    // - orchestrator + cheap (intent_classification) → routing
    // - orchestrator + expensive (decision_synthesis, cross_agent_synthesis) → synthesis
    // - others → same agentId
    const configAgentId = this.resolveConfigAgentId(agentId, task, preferCheap);

    const {
      client,
      provider: providerEnum,
      model,
    } = await this.getProvider(userId, configAgentId, override);
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
      const response = await client.complete(systemPrompt, userPrompt);

      // Track call for health monitoring
      recordCall(userId, providerEnum, true);

      // Log usage asynchronously (fire-and-forget)
      if (this.llmUsageService) {
        const source =
          task === 'intent_classification' || task === 'cross_agent_synthesis'
            ? LLMSource.CHAT
            : LLMSource.TRADING;
        this.llmUsageService
          .log({
            userId,
            provider: providerEnum as any,
            model,
            usage: response.usage,
            source,
          })
          .catch((err) =>
            this.logger.warn(
              `Usage log failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }

      return response.text;
    } catch (err) {
      recordCall(
        userId,
        providerEnum,
        false,
        err instanceof Error ? err.message : String(err),
      );
      this.logger.warn(
        `SubAgent[${agentId}] task=${task} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  /**
   * Maps a sub-agent call to the correct config AgentId for model resolution.
   */
  private resolveConfigAgentId(
    agentId: SubAgentId,
    task: AgentTask,
    preferCheap: boolean,
  ): string {
    if (agentId === 'orchestrator') {
      // Intent classification uses fast/cheap "routing" model
      if (task === 'intent_classification' || preferCheap) return 'routing';
      // Decision synthesis and cross-agent synthesis use powerful "synthesis" model
      return 'synthesis';
    }
    return agentId;
  }

  /**
   * Get an LLMProviderClient for a specific agent.
   * Resolution order:
   *   1. Explicit override
   *   2. AgentConfigResolver (user > admin > fallback)
   *   3. Fallback: first active credential
   */
  async getProvider(
    userId: string,
    configAgentId: string,
    override?: { provider: LLMProvider; model: string },
  ): Promise<{
    client: LLMProviderClient;
    provider: LLMProvider;
    model: string;
  }> {
    // Helper: validate resolved provider is active at platform level (Spec 38, Fix P4)
    const assertActive = async (provider: LLMProvider) => {
      if (this.platformLLMProviderService) {
        await this.platformLLMProviderService.assertProviderActive(provider);
      }
    };

    // 1. Explicit override
    if (override) {
      const cred = await this.prisma.lLMCredential.findFirst({
        where: { userId, provider: override.provider as any, isActive: true },
      });
      if (cred) {
        await assertActive(override.provider);
        const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
        const client =
          override.provider === LLMProvider.OPENROUTER
            ? new OpenRouterProvider({
                apiKey,
                model: override.model,
                fallbackModels: (cred as any).fallbackModels ?? [],
              })
            : createLLMProvider(override.provider, apiKey, override.model);
        return {
          client,
          provider: override.provider,
          model: override.model,
        };
      }
    }

    // 2. AgentConfigResolver — resolve per-agent config
    if (this.agentConfigResolver) {
      try {
        const resolved = await this.agentConfigResolver.resolveConfig(
          configAgentId as any,
          userId,
        );
        const cred = await this.prisma.lLMCredential.findFirst({
          where: { userId, provider: resolved.provider as any, isActive: true },
        });
        if (cred) {
          await assertActive(resolved.provider as unknown as LLMProvider);
          const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
          const client =
            resolved.provider === (LLMProvider.OPENROUTER as any)
              ? new OpenRouterProvider({
                  apiKey,
                  model: resolved.model,
                  fallbackModels: (cred as any).fallbackModels ?? [],
                })
              : createLLMProvider(
                  resolved.provider as unknown as LLMProvider,
                  apiKey,
                  resolved.model,
                );
          return {
            client,
            provider: resolved.provider as unknown as LLMProvider,
            model: resolved.model,
          };
        }
      } catch (err) {
        this.logger.warn(
          `AgentConfigResolver failed for ${configAgentId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 3. Fallback: first active credential
    const allCreds = await this.prisma.lLMCredential.findMany({
      where: { userId, isActive: true },
    });

    if (allCreds.length > 0) {
      const cred = allCreds[0];
      const credProvider = cred.provider as LLMProvider;
      await assertActive(credProvider);
      const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
      const client =
        credProvider === LLMProvider.OPENROUTER
          ? new OpenRouterProvider({
              apiKey,
              model: cred.selectedModel,
              fallbackModels: (cred as any).fallbackModels ?? [],
            })
          : createLLMProvider(credProvider, apiKey, cred.selectedModel);
      return {
        client,
        provider: credProvider,
        model: cred.selectedModel ?? client.name,
      };
    }

    throw new Error(
      `No active LLM credentials for user ${userId}. Configure them in Settings.`,
    );
  }
}
