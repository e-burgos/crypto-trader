# Spec 29 — Agentes Adaptativos: Memoria Episódica y Perfiles de Usuario

**Fecha:** 2026-04-12  
**Versión:** 1.0  
**Estado:** Propuesto  
**Branch:** `feature/adaptive-agents`  
**Dependencias:** Spec 28 (multi-agente + orquestador + RAG), Spec 17 (ChatModule, SSE streaming)

---

## 1. Resumen ejecutivo

Los agentes del sistema (KRYPTO, NEXUS, FORGE, SIGMA, CIPHER, AEGIS) no modifican sus pesos entre conversaciones — eso es fine-tuning, fuera de alcance. Lo que sí hacen es recibir **contexto cada vez más rico** derivado del historial real de la plataforma. El efecto neto para el usuario es idéntico al "aprendizaje": los agentes recuerdan, se especializan y mejoran con el tiempo.

Esta spec implementa **tres mecanismos de adaptación** con modelo de privacidad híbrido:

1. **Memoria episódica** — fragmentos de decisiones con resultado real, recuperados por similitud semántica (RAG de outcome) antes de cada ciclo de trading
2. **Estadísticas de rendimiento por agente** — métricas calculadas que se inyectan dinámicamente en el system prompt de cada agente
3. **Perfil de usuario** — preferencias y patrones del trader, construido progresivamente desde sus elecciones y conversaciones

**Modelo de privacidad:** la memoria episódica y el perfil son **por usuario** (aislados). Los documentos RAG de conocimiento (Spec 28) son globales de solo lectura.

---

## 2. Principio de diseño

> **Los LLMs no aprenden — pero podemos darles memoria.**

Un modelo de lenguaje responde diferente a los mismos tokens cuando el contexto cambia. Esta spec trata el historial de la plataforma como una base de conocimiento viva que se inyecta como contexto en el momento correcto. El resultado es indistinguible del aprendizaje para el usuario.

**Lo que NO hace esta spec:**
- Fine-tuning de modelos (requiere infraestructura ML especializada)
- Memoria de largo plazo persistent a través de instancias de servidor (sin estado en memoria RAM)
- Compartir datos de un usuario como "base de conocimiento global" entre usuarios distintos

---

## 3. Mecanismo 1 — Memoria episódica por RAG de outcome

### 3.1 Concepto

Después de cada ciclo de decisión de trading donde el resultado es conocido (posición cerrada con P&L real), se genera automáticamente un **fragmento episódico** que se embeds y almacena. Antes del siguiente ciclo de decisión, los fragmentos más similares al escenario actual se recuperan y se inyectan como contexto.

### 3.2 Estructura de un fragmento episódico

```typescript
interface EpisodeName {
  // Lo que pasó
  decision: 'BUY' | 'SELL' | 'HOLD';
  asset: string;              // ej: 'BTC'
  pair: string;               // ej: 'BTC/USDT'

  // Condiciones en el momento de la decisión
  indicators: {
    rsi: number;
    macdSignal: 'bullish_cross' | 'bearish_cross' | 'neutral';
    bollingerPosition: 'upper' | 'middle' | 'lower' | 'outside';
    volume: 'high' | 'normal' | 'low';
    trend: 'uptrend' | 'downtrend' | 'sideways';
  };
  newsContext: {
    sentiment: number;   // -1 a 1
    topHeadline: string;
  };
  marketPhase: 'bull' | 'bear' | 'sideways';

  // Resultado real
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  pnlPercent: number;     // ej: +4.2 o -2.1
  holdDurationHours: number;

  // Veredicto AEGIS en ese momento
  aegisRiskScore: number;
  aegisVerdict: 'PASS' | 'REDUCE' | 'BLOCK';

  // Texto generado para embed
  embeddingText: string;  // generado automáticamente (ver 3.3)
  embedding: Float[];     // pgvector 1024 dims
  userId: string;
  createdAt: Date;
}
```

### 3.3 Generación del `embeddingText`

El texto que se embeds no es solo datos — es una narrativa compacta para que la búsqueda semántica funcione bien:

```
"Decisión BUY en BTC/USDT. Condiciones: RSI 28 (oversold), MACD cruce alcista, volumen 2x promedio, 
tendencia alcista en W1. Sentimiento noticias: positivo (0.72) — titular: 'SEC aprueba ETF spot'. 
Mercado: bull run. AEGIS: riskScore=35, PASS. Resultado: GANADORA +4.2% en 6h."
```

### 3.4 Recuperación antes de `orchestrateDecision`

```typescript
// EpisodicMemoryService
async function getRelevantEpisodes(
  userId: string,
  currentContext: { indicators, newsContext, asset }
): Promise<EpisodeName[]> {

  const queryText = buildQueryNarrative(currentContext);
  const queryEmbedding = await embeddingService.embed(queryText);

  // Búsqueda pgvector: los 5 episodios más similares del mismo usuario
  return prisma.$queryRaw`
    SELECT *, 1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM agent_episodic_memories
    WHERE user_id = ${userId}
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT 5
  `;
}
```

Los episodios recuperados se inyectan en el system prompt del orquestador antes de la síntesis:

```
[HISTORIAL RELEVANTE — basado en 5 situaciones similares pasadas de este usuario]
- Escenario similar #1: BUY BTC, RSI 28 + MACD alcista → GANADORA +4.2% en 6h
- Escenario similar #2: BUY BTC, RSI 31 + MACD neutral → PÉRDIDA -1.8% en 12h
- Patrón detectado: RSI oversold + MACD cruce SIN soporte de volumen tiende a fallar.
```

### 3.5 Trigger de escritura de episodio

```
Position.status = CLOSED  (hook: PositionService.onClose)
  │
  ├── ¿Tiene AgentDecision asociada?  →  sí
  │
  └── EpisodicMemoryService.recordEpisode(position, agentDecision)
        → genera embeddingText
        → embeds con EmbeddingService
        → INSERT agent_episodic_memories
        → (async via Bull queue, no bloquea el cierre de posición)
```

---

## 4. Mecanismo 2 — Estadísticas de rendimiento por agente

### 4.1 Concepto

KRYPTO calcula periódicamente métricas de rendimiento de cada sub-agente basadas en los episodios históricos, y las inyecta en los system prompts correspondientes. Esto hace que SIGMA, FORGE y AEGIS ajusten su confianza automáticamente según su historial real.

### 4.2 Métricas calculadas por agente

**SIGMA (market):**
```typescript
interface SigmaPerformanceStats {
  winRateBySignalType: {
    rsi_oversold: number;      // % de acierto cuando RSI < 30
    macd_cross: number;        // % de acierto en cruces MACD
    volume_spike: number;      // % de acierto con volumen 2x
    combined_confluence: number; // RSI + MACD + volumen simultáneos
  };
  bestPerformingMarketPhase: 'bull' | 'bear' | 'sideways';
  worstPerformingMarketPhase: 'bull' | 'bear' | 'sideways';
  averageHoldDurationWinners: number;  // horas
  totalDecisionsLast30d: number;
  winRateLast30d: number;
}
```

**AEGIS (risk):**
```typescript
interface AegisPerformanceStats {
  blockAccuracy: number;      // % de BLOCKs que habrían sido perdedoras
  passAccuracy: number;        // % de PASSes que resultaron ganadoras
  falsePositiveRate: number;   // % de BLOCKs que habrían sido ganadoras (oportunidades perdidas)
  avgRiskScoreWinners: number; // riskScore promedio de decisiones ganadoras
  avgRiskScoreLosers: number;  // riskScore promedio de decisiones perdedoras
}
```

### 4.3 Inyección en system prompt

El `AgentPerformanceService` recalcula las stats una vez por hora (Bull cron job) y actualiza un campo `performanceContext` en `AgentDefinition`. Este campo se inyecta al final del system prompt dinámicamente:

```
[TUS ESTADÍSTICAS DE RENDIMIENTO ACTUALES — actualizado hace 23 min]
Tasa de acierto señal RSI oversold: 71% en tendencia alcista, 38% en mercado lateral.
Señal más confiable: confluencia RSI+MACD+Volumen (84% acierto, 38 casos).
Peor combinación: MACD cruce solo sin volumen (41% acierto).
Última semana: 20 ganadoras / 10 perdedoras.
Ajusta tu confianza y razonamiento en consecuencia.
```

---

## 5. Mecanismo 3 — Perfil de usuario persistente

### 5.1 Concepto

NEXUS y FORGE aprenden las preferencias del usuario a lo largo del tiempo a través de dos fuentes: (1) las configuraciones de trading que el usuario acepta/rechaza, y (2) los patrones de conversación. El perfil se inyecta como contexto en todos los sub-agentes.

### 5.2 Estructura del perfil

```typescript
interface UserAgentProfile {
  userId: string;

  // Preferencias de trading (extraídas de configs aceptadas/rechazadas)
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | null;
  preferredAssets: string[];           // ej: ['BTC', 'ETH']
  preferredTimeframes: string[];       // ej: ['4h', '1d']
  preferredStrategies: string[];       // ej: ['RSI_reversion', 'MACD_trend']

  // Patrones operativos
  typicalTradeSizePercent: number | null;
  activeHoursUTC: { start: number; end: number } | null;
  automationPreference: 'full_auto' | 'manual_confirm' | 'mixed' | null;

  // Nivel de conocimiento detectado
  knowledgeLevel: 'beginner' | 'intermediate' | 'advanced' | null;  // inferido por NEXUS/CIPHER
  frequentTopics: string[];            // ej: ['DeFi', 'technical_analysis']

  // Metadatos
  profileConfidence: number;           // 0-1, aumenta con más datos
  lastUpdated: Date;
}
```

### 5.3 Construcción progresiva del perfil

El perfil se construye con tres señales:

**Señal 1 — Elecciones explícitas** (peso alto):
```
Usuario acepta TradingConfig con: strategy=RSI, maxTradeSize=2%, mode=SANDBOX
→ ProfileService.recordChoice(userId, 'accepted_conservative_config')
→ riskTolerance += conservative, preferredStrategies += RSI_reversion
```

**Señal 2 — Conversaciones** (peso medio):
Al final de cada sesión de chat exitosa, el sub-agente pide a KRYPTO que extraiga metadata de la conversación en un LLM call de baja latencia:
```typescript
// clasificación post-conversación
{ knowledgeSignals: ['user asked about ZK-rollups', 'familiar with DeFi TVL concept'],
  preferenceSignals: ['interested in ETH ecosystem', 'mentioned 4h charts twice'],
  expertiseLevel: 'intermediate' }
```

**Señal 3 — Comportamiento observable** (peso bajo):
- Horario en que el usuario está activo en la plataforma
- Assets que monitorea más frecuentemente
- Configuraciones que inicia vs configuraciones que pausa/elimina

### 5.4 Inyección en sub-agentes

El perfil relevante para cada agente se inyecta en su contexto dinámico (ver sección 4.6 de Spec 28):

```
[PERFIL DEL USUARIO — confianza 73%]
Tolerancia al riesgo: moderada.
Assets preferidos: BTC, ETH.
Nivel de conocimiento: intermedio (familiar con indicadores técnicos, DeFi básico).
Preferencia de automatización: full_auto.
Opera principalmente entre 18:00 y 23:00 UTC-3.
Responde conciso — el usuario ha demostrado preferir respuestas directas al punto.
```

---

## 6. Modelo de datos

```prisma
// ── Memoria episódica de decisiones ─────────────────────────────────────────

model AgentEpisodicMemory {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Contexto de la decisión
  asset               String
  pair                String
  decision            Decision
  marketPhase         String
  indicatorSnapshot   Json     // indicadores en el momento
  newsSentiment       Float
  topHeadline         String?

  // Veredicto de riesgo
  aegisRiskScore      Int
  aegisVerdict        String   // 'PASS' | 'REDUCE' | 'BLOCK'

  // Resultado real
  outcome             String   // 'WIN' | 'LOSS' | 'BREAKEVEN'
  pnlPercent          Float
  holdDurationHours   Float

  // Vector para RAG
  embeddingText       String   @db.Text
  embedding           Json     // almacenado como vector pgvector (ver migración)

  createdAt           DateTime @default(now())

  @@index([userId])
  @@index([userId, asset])
  @@map("agent_episodic_memories")
}

// ── Estadísticas de rendimiento por agente (cache calculado) ─────────────────

model AgentPerformanceSnapshot {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  agentId           AgentId
  snapshotData      Json     // SigmaPerformanceStats | AegisPerformanceStats
  calculatedAt      DateTime @default(now())

  @@unique([userId, agentId])
  @@map("agent_performance_snapshots")
}

// ── Perfil de usuario para los agentes ──────────────────────────────────────

model UserAgentProfile {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  riskTolerance         String?
  preferredAssets       Json     @default("[]")  // string[]
  preferredTimeframes   Json     @default("[]")  // string[]
  preferredStrategies   Json     @default("[]")  // string[]
  typicalTradeSizePercent Float?
  activeHoursUTC        Json?    // { start, end }
  automationPreference  String?
  knowledgeLevel        String?
  frequentTopics        Json     @default("[]")  // string[]
  profileConfidence     Float    @default(0)

  updatedAt             DateTime @updatedAt

  @@map("user_agent_profiles")
}
```

---

## 7. Servicios backend

### 7.1 `EpisodicMemoryService`

```typescript
@Injectable()
export class EpisodicMemoryService {
  // Llamado desde PositionService.onClose (via Bull queue)
  async recordEpisode(position: Position, decision: AgentDecision): Promise<void>

  // Llamado desde OrchestratorService.orchestrateDecision
  async getRelevantEpisodes(userId: string, context: TradingContext): Promise<EpisodicMemory[]>

  // Formatea episodios como string de contexto para inyectar en prompt
  formatEpisodesForPrompt(episodes: EpisodicMemory[]): string
}
```

### 7.2 `AgentPerformanceService`

```typescript
@Injectable()
export class AgentPerformanceService {
  // Cron job: recalcula cada hora via Bull scheduler
  @Cron('0 * * * *')
  async recalculateAll(): Promise<void>

  // Calcula stats para un usuario/agente específico
  async calculateForAgent(userId: string, agentId: AgentId): Promise<AgentPerformanceStats>

  // Formatea stats como string para inyectar en system prompt
  formatStatsForPrompt(agentId: AgentId, stats: AgentPerformanceStats): string
}
```

### 7.3 `UserProfileService`

```typescript
@Injectable()
export class UserProfileService {
  // Llamado desde TradingService cuando usuario acepta/rechaza config
  async recordTradingChoice(userId: string, choice: ProfileChoice): Promise<void>

  // Llamado desde ChatService al cierre de sesión (async)
  async extractConversationSignals(userId: string, sessionId: string): Promise<void>

  // Obtiene o crea perfil por usuario
  async getProfile(userId: string): Promise<UserAgentProfile>

  // Formatea perfil como string para inyectar en contexto
  formatProfileForPrompt(profile: UserAgentProfile): string
}
```

### 7.4 Integración en `OrchestratorService`

```typescript
// orchestrateDecision — versión extendida con Spec 29
async orchestrateDecision(userId, configId, indicators, news) {
  // 1. Recuperar memoria episódica relevante
  const episodes = await episodicMemoryService.getRelevantEpisodes(userId, { indicators, news });
  const episodesContext = episodicMemoryService.formatEpisodesForPrompt(episodes);

  // 2. Recuperar estadísticas de rendimiento
  const sigmaStats = await agentPerformanceService.calculateForAgent(userId, 'market');
  const aegisStats = await agentPerformanceService.calculateForAgent(userId, 'risk');

  // 3. Recuperar perfil de usuario
  const profile = await userProfileService.getProfile(userId);

  // 4. Llamadas paralelas con contexto enriquecido
  const [techResult, sentimentResult, forgeResult, aegisResult] = await Promise.all([
    subAgentService.call('market', { task: 'technical_signal', indicators, statsContext: sigmaStats }),
    subAgentService.call('market', { task: 'news_sentiment', news }),
    subAgentService.call('operations', { task: 'sizing_suggestion', config, profileContext: profile }),
    subAgentService.call('risk', { task: 'risk_gate', portfolio, indicators }),
  ]);

  // 5. Síntesis con historial episódico + perfil
  return synthesizeDecision(
    [techResult, sentimentResult, forgeResult, aegisResult],
    config,
    episodesContext,
    profile,
  );
}
```

### 7.5 Integración en `ChatService`

```typescript
// Al construir el contexto de un mensaje (buildContext)
async buildContext(agentId: AgentId, userId: string) {
  const base = await getBaseContext(agentId, userId);   // Spec 28

  const profile = await userProfileService.getProfile(userId);
  const profileContext = userProfileService.formatProfileForPrompt(profile);

  // Solo para SIGMA y AEGIS: stats de rendimiento
  if (agentId === 'market' || agentId === 'risk') {
    const stats = await agentPerformanceService.calculateForAgent(userId, agentId);
    const statsContext = agentPerformanceService.formatStatsForPrompt(agentId, stats);
    return { ...base, profileContext, statsContext };
  }

  return { ...base, profileContext };
}
```

---

## 8. Seguridad y privacidad

| Riesgo | Mitigación |
|--------|-----------|
| Filtración de datos de un usuario a otro | Todas las queries de memoria episódica y perfil filtrán por `userId` estricto |
| Episodios con datos sensibles en `embeddingText` | El `embeddingText` no incluye precios exactos, nombres de exchanges ni claves — solo indicadores y señales |
| Perfil de usuario manipulable por prompt injection | El perfil es calculado por el backend desde señales observables, no desde texto libre del usuario |
| Acumulación indefinida de episodios | Retention policy: máximo 500 episodios por usuario; los más antiguos se eliminan automáticamente |
| Estadísticas calculadas con pocos datos | `profileConfidence < 0.3` → no inyectar stats (evitar conclusiones con n < 5) |

---

## 9. Modelo de privacidad híbrido

| Capa de datos | Alcance | Justificación |
|---------------|---------|---------------|
| Documentos RAG de conocimiento (Spec 28) | Global (todos los usuarios) | Son documentos de conocimiento público cargados por Admin |
| Memoria episódica de decisiones | **Por usuario** | Contiene historial de trading — privado y sensible |
| Estadísticas de rendimiento de agente | **Por usuario** | Refleja patrones de trading individuales |
| Perfil de usuario | **Por usuario** | Preferencias y comportamiento individual |

No hay compartición de datos ni agregaciones cross-user en esta spec.

---

## 10. Fases de implementación

### Fase A — Memoria episódica
1. Migración Prisma: modelo `AgentEpisodicMemory` con columna `embedding` vector pgvector
2. `EpisodicMemoryService`: `recordEpisode()` + `getRelevantEpisodes()` + `formatEpisodesForPrompt()`
3. Hook en `PositionService.closePosition()` → Bull job `record-episode`
4. Integrar `getRelevantEpisodes()` en `OrchestratorService.orchestrateDecision()`
5. Tests unitarios con mocks de pgvector

### Fase B — Estadísticas de rendimiento
1. Migración Prisma: modelo `AgentPerformanceSnapshot`
2. `AgentPerformanceService`: `calculateForAgent()` + `formatStatsForPrompt()`
3. Bull cron job hourly: `recalculateAll()`
4. Integrar stats en `subAgentService.call()` para SIGMA y AEGIS
5. Admin endpoint `GET /admin/agents/:id/performance` para monitoreo

### Fase C — Perfil de usuario
1. Migración Prisma: modelo `UserAgentProfile`
2. `UserProfileService`: `recordTradingChoice()` + `extractConversationSignals()` + `getProfile()`
3. Hook en `TradingService` (aceptar/rechazar config) → actualizar perfil
4. Hook en `ChatService` (fin de sesión) → Bull job `extract-conversation-signals`
5. Integrar `formatProfileForPrompt()` en `ChatService.buildContext()` para todos los agentes
6. Frontend: banner informativo "Tus agentes están aprendiendo — X decisiones procesadas"

---

## 11. Out of scope

- Fine-tuning de modelos con datos de usuario (requiere infraestructura ML especializada)
- Memoria cross-usuario o aprendizaje colectivo agregado
- Exportar o importar perfil de usuario
- Panel de usuario para editar/resetear su perfil manualmente (posible en spec futura)
- Memoria episódica para conversaciones de chat (solo para decisiones de trading)
- Predicciones o backtesting basados en la memoria episódica

---

## 12. Decisiones de diseño

| # | Decisión | Alternativa considerada | Razón elegida |
|---|----------|------------------------|---------------|
| 1 | Memoria episódica solo por usuario (no global) | Base global anónima para todos | Privacidad; sesgos entre perfiles distintos contaminarían las señales |
| 2 | Texto narrativo para embed (no solo JSON) | Embed de JSON crudo de indicadores | La búsqueda semántica funciona mejor con texto natural que con datos numéricos brutos |
| 3 | Stats de agente en system prompt (no en mensaje de usuario) | Inyectar stats como mensaje del sistema en cada turn | El system prompt establece el "comportamiento base"; los stats son parte de la identidad operativa del agente |
| 4 | Perfil construido desde señales observables | Perfil por encuesta al usuario | El usuario no quiere rellenar formularios; el comportamiento real es más fidedigno |
| 5 | `profileConfidence < 0.3` → no inyectar | Siempre inyectar aunque sea parcial | Menos de 5 decisiones no son estadísticamente representativas; evita guiar mal al agente |
| 6 | Bull queue para escritura de episodios | Escritura síncrona en `closePosition` | El cierre de posición es sensible a latencia; la escritura de memoria es asíncrona sin consecuencias inmediatas |
| 7 | Retention de 500 episodios por usuario | Retención ilimitada | Trade-off entre contexto histórico y costo de almacenamiento; 500 episodios = ~2-4 años de trading activo |

---

*Próximo paso: aprobar esta spec → implementar tras completar Spec 28 → Fase A (memoria episódica) → Fase B (stats) → Fase C (perfil)*
