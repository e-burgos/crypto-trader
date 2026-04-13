# Spec 28 — Sistema Multi-Agente con Orquestador, RAG y Control de Admin

**Fecha:** 2026-04-12  
**Versión:** 2.1  
**Estado:** Propuesto  
**Branch:** `feature/multi-agent-chat-rag`  
**Dependencias:** Spec 17 (ChatModule, ChatSession, ChatMessage, SSE streaming), Spec 15 (backend completo)

---

## 1. Resumen ejecutivo

Esta spec evoluciona el chatbot KRYPTO (Spec 17) a un **sistema multi-agente con orquestador central**. Hay cinco entidades de IA:

- **Un Orquestador (KRYPTO)** — el cerebro central que está presente en **todo uso de IA de la plataforma**: enruta mensajes de chat, coordina decisiones de trading y análisis de noticias.
- **Cinco sub-agentes especializados** — cada uno con identidad propia, system prompt dedicado y base de conocimiento ampliable por Admin mediante RAG: **NEXUS** (plataforma), **FORGE** (operaciones), **SIGMA** (mercado), **CIPHER** (blockchain) y **AEGIS** (gestión de riesgo).

El orquestador **nunca habla directamente al usuario** en el chat (salvo para enrutar). Su papel es clasificar intención, seleccionar el sub-agente correcto, pasarle el contexto limpio y sintetizar respuestas multi-agente cuando la tarea lo requiere. En los pipelines de trading y análisis de noticias, el orquestador es la capa que coordina consultas paralelas a sub-agentes para producir decisiones de mayor calidad.

---

## 2. El Orquestador — KRYPTO

**ID:** `orchestrator`  
**Propósito:** Cerebro central e intermediario de todo sistema de IA en la plataforma.

| Atributo | Valor |
|----------|-------|
| Nombre visible | KRYPTO |
| Color / avatar | `bg-gradient-to-br from-primary to-purple-500` — ícono `Brain` |
| Tono | Eficiente, transparente, nunca habla de sí mismo — todo lo canaliza |
| Scope | Global — orquesta chat, trading pipeline y análisis de noticias |
| Habla al usuario | Solo para anunciar enrutamiento: "Te conecto con el Analista de Mercado…" |

### 2.1 Responsabilidades del orquestador

#### A) Clasificación de intención en chat (Intent Router)
Cuando el usuario inicia una conversación **sin seleccionar sub-agente**, el orquestador recibe el primer mensaje y en una sola llamada LLM de baja latencia determina:

```typescript
interface IntentClassification {
  agentId: 'platform' | 'operations' | 'market' | 'blockchain' | 'risk';
  confidence: number;       // 0-1
  reason: string;           // para log/debug, no se muestra al usuario
  suggestedGreeting: string; // primer mensaje del sub-agente, listo para streamear
}
```

El resultado es inmediato y transparente para el usuario (ve "KRYPTO te conecta con…" por ~300ms y luego la sesión fluye con el sub-agente correcto).

#### B) Coordinación de decisiones de trading (Trading Orchestration)
Antes de que el agente de trading emita su decisión final BUY/SELL/HOLD, el orquestador coordina tres LLM calls **en paralelo**:

```
Indicadores técnicos ──────→ Sub-agente: market    ──→ { signal, confidence, reasoning }
Noticias + sentimiento ─────→ Sub-agente: market    ──→ { sentiment, impact, reasoning }
Historial + config usuario ─→ Sub-agente: operations──→ { risk_assessment, recommendation }
        └────────────────────────────────────────────────────────┐
                                                                 ▼
                                                     Orquestador sintetiza
                                                     → DecisionPayload final
                                                       { decision, confidence, reasoning }
```

#### C) Enriquecimiento de análisis de noticias (News Enrichment)
Cuando el pipeline fetcha noticias para el agente de trading, el orquestador corre en paralelo:

```
Título + resumen noticia ──→ Sub-agente: market     ──→ relevancia técnica
Título + resumen noticia ──→ Sub-agente: blockchain ──→ impacto ecosistema
           └──────────────────────────────────────────────────┐
                                                              ▼
                                                  Orquestador sintetiza
                                                  → NewsEnrichment { sentiment, score, tags }
```

#### D) Síntesis cross-agente (consultas complejas)
Si una consulta del usuario cruza dominios (ej. "¿Conviene comprar ETH ahora y qué es una pool de liquidez?") el orquestador llama a `market` Y `blockchain` en paralelo y sintetiza sus respuestas en una sola respuesta cohesionada.

### 2.2 System prompt del orquestador

El orquestador usa un modelo rápido y barato (Groq `llama-3.3-70b` o GPT-4o-mini) para la clasificación de intención y síntesis ligera. Para síntesis de decisiones de trading usa el mismo modelo configurado por el usuario.

```
Eres KRYPTO, el orquestador central de la plataforma CryptoTrader.
Tu único propósito es clasificar y enrutar; NUNCA das información directamente al usuario.

Para clasificación de intención, responde SOLO con JSON:
{ "agentId": "<platform|operations|market|blockchain|risk>", "confidence": 0.95, "reason": "...", "suggestedGreeting": "..." }

Para síntesis de decisiones de trading, combina las perspectivas recibidas y devuelve:
{ "decision": "<BUY|SELL|HOLD>", "confidence": 0.0-1.0, "reasoning": "...", "waitMinutes": N }

Para síntesis cross-agente, produce una respuesta unificada y fluida integrando ambas perspectivas.
Siempre responde en el idioma que el usuario usó.
```

---

## 3. Los cinco sub-agentes

### 3.1 NEXUS — Experto en CryptoTrader
**ID:** `platform` | **Nombre:** NEXUS  
**Propósito:** Mentor de uso de la plataforma CryptoTrader.

> *"Soy NEXUS. Conozco cada rincón de CryptoTrader: cada parámetro, cada pantalla, cada decisión de diseño detrás del sistema. Si algo no queda claro, yo te lo explico."*

| Atributo | Valor |
|----------|-------|
| Nombre visible | NEXUS |
| Color / avatar | `bg-primary` — ícono `BookOpen` |
| Tono | Cálido, paciente, pedagógico — nunca abrumador |
| Scope | Solo sabe de CryptoTrader: arquitectura, pantallas, indicadores, configuraciones, modos |
| Acción principal | Guiar al usuario por cada funcionalidad de la plataforma |
| Capacidad especial | Puede **redireccionar** al usuario a otro sub-agente si la consulta excede su scope |

**Conocimiento base precargado:**
- Descripción completa de cada sección del dashboard
- Cada parámetro de `TradingConfig` con valores recomendados y por qué
- Flujo del ciclo del agente (BUY → posición abierta → SELL / stop-loss / take-profit)
- Modos: SANDBOX vs TESTNET vs LIVE — diferencias y cuándo usar cada uno
- Guía de configuración por perfil de riesgo (conservador / moderado / agresivo)
- FAQ de problemas comunes (claves Binance rechazadas, agente no inicia, etc.)
- Instrucciones de onboarding paso a paso

---

### 3.2 FORGE — Asistente de Operaciones
**ID:** `operations` | **Nombre:** FORGE  
**Propósito:** Ejecutor de operaciones y configuraciones de trading.

> *"Soy FORGE. No analizo — actúo. Dame un objetivo y construimos el camino operativo para llegar."*

| Atributo | Valor |
|----------|-------|
| Nombre visible | FORGE |
| Color / avatar | `bg-emerald-500` — ícono `Zap` |
| Tono | Directo, metódico, orientado a acción — confirma antes de ejecutar |
| Scope | Operaciones de trading: crear configs, start/stop agentes, órdenes manuales, gestión de posiciones |
| Acción principal | Asistir en la configuración y ejecución de operaciones DeFi |
| Capacidad especial | **Puede ejecutar acciones en la plataforma** mediante herramientas (ver sección 6) |

**Conocimiento base precargado:**
- Flujos de configuración de nuevos agentes con estrategias detalladas
- Parámetros críticos por tipo de mercado (tendencia, rango, alta volatilidad)
- Gestión de riesgo: position sizing, diversificación, stop-loss dinámico
- Estrategias de entrada/salida para BTC/ETH
- Interpretación de señales de indicadores para tomar decisiones manuales
- Mejores prácticas de DeFi: timing, fees, slippage, liquidez

---

### 3.3 SIGMA — Analista de Mercado
**ID:** `market` | **Nombre:** SIGMA (Σ)  
**Propósito:** Experto en análisis técnico y noticias del mercado crypto.

> *"Soy SIGMA. Leo el mercado en datos, no en opiniones. Cada señal tiene un número detrás, y ese número cuenta una historia."*

| Atributo | Valor |
|----------|-------|
| Nombre visible | SIGMA |
| Color / avatar | `bg-amber-500` — ícono `TrendingUp` |
| Tono | Frío, objetivo, cuantitativo — explica el razonamiento detrás de cada número |
| Scope | Análisis técnico, sentimiento de noticias, perspectiva del mercado crypto |
| Acción principal | Dar contexto de mercado informado, perspectivas BTC/ETH, análisis de indicadores en tiempo real |
| Capacidad especial | Accede al **snapshot de mercado en tiempo real** como contexto de cada mensaje |

**Conocimiento base precargado:**
- Interpretación avanzada de RSI, MACD, Bollinger Bands, EMA, Volumen
- Patrones de velas japonesas relevantes en crypto (doji, engulfing, hammer, shooting star)
- Correlación entre noticias macro y movimientos de BTC/ETH
- Ciclos de mercado: acumulación, distribución, bull/bear market
- Análisis on-chain básico: SOPR, MVRV, Net Unrealized Profit/Loss
- Fuentes de noticias financieras confiables y señales de alerta
- Market cap dominance BTC y su relación con altcoins

---

### 3.4 CIPHER — Experto en Blockchain
**ID:** `blockchain` | **Nombre:** CIPHER  
**Propósito:** Eminencia en el ecosistema blockchain y tecnología descentralizada.

> *"Soy CIPHER. Blockchain no tiene secretos para mí — desde ECDSA hasta ZK Rollups. ¿Tienes una pregunta? La respondo desde cero o desde el nivel que necesites."*

| Atributo | Valor |
|----------|-------|
| Nombre visible | CIPHER |
| Color / avatar | `bg-purple-500` — ícono `Network` |
| Tono | Intelectual, adaptable al nivel del usuario — disfruta la profundidad técnica |
| Scope | Tecnología blockchain, criptografía, DeFi, Web3, Layer 2, NFTs, DAOs, regulación |
| Acción principal | Educar sobre el ecosistema blockchain de nivel básico a avanzado |
| Capacidad especial | Ninguna — conversación pura, sin acceso a datos de plataforma ni mercado |

**Conocimiento base precargado (el más extenso):**
- Fundamentos: hashing, Merkle trees, bloques, consenso, nodos completos vs livianos
- Criptografía: ECDSA, curvas elípticas, derivación de claves BIP-32/39/44, multisig
- Bitcoin: UTXO model, script, segwit, taproot, lightning network, halvings
- Ethereum: EVM, gas, account model, EIP-1559, Proof of Stake (merge), staking
- Smart contracts: Solidity básico, patrones (proxy, factory, access control), auditoría
- DeFi: AMMs (Uniswap v2/v3), lending (Aave, Compound), yield farming, impermanent loss
- Tokens: ERC-20, ERC-721, ERC-1155, ERC-4626 (vault), tokenomics design
- Layer 2: Optimistic Rollups (Arbitrum, Optimism), ZK Rollups (zkSync, Starknet), sidechains
- NFTs: estándares, metadata, marketplaces, casos de uso reales vs especulativos
- DAOs: governance tokens, quorum, timelock, snapshot voting
- Stablecoins: colateralizados (DAI), algorítmicos, CBDC
- Seguridad: ataques comunes (reentrancy, front-running, oracle manipulation), seed phrase safety
- Regulación: MiCA (Europa), posiciones de SEC/CFTC, AML/KYC en crypto, panorama 2025-2026

---

### 3.5 AEGIS — Gestor de Riesgo
**ID:** `risk` | **Nombre:** AEGIS  
**Propósito:** Guardián del portfolio — evalúa riesgo antes de cada decisión de trading y en consultas de gestión.

> *"Soy AEGIS, el gestor de riesgo de tu portfolio. Mi trabajo no es decirte qué va a pasar — es asegurarme de que nada de lo que pase te saque del juego. Primero la supervivencia, después las ganancias."*

| Atributo | Valor |
|----------|-------|
| Nombre visible | AEGIS |
| Color / avatar | `bg-red-500` — ícono `Shield` |
| Tono | Conservador, cuantitativo, directo — nunca dice "probablemente esté bien", siempre cuantifica |
| Scope | Gestión de riesgo: sizing de posiciones, exposición del portfolio, drawdown, correlación de activos |
| Acción principal | Emitir un veredicto `PASS \| REDUCE \| BLOCK` antes de cada decisión BUY/SELL del orquestador |
| Capacidad especial | Accede al **portfolio completo del usuario** (posiciones abiertas, P&L, historial de drawdown) |

**Output estructurado en `orchestrateDecision` (Flow B):**
```typescript
interface AegisVerdict {
  riskScore: number;               // 0–100 (100 = riesgo máximo)
  verdict: 'PASS' | 'REDUCE' | 'BLOCK';
  positionSizeMultiplier: number;  // 1.0 = normal, 0.5 = mitad, 0 = bloquear
  reason: string;
  alerts: string[];                // ej: ["Sobreexposición BTC >40%", "Drawdown semanal >10%"]
}
```

**Reglas de veredicto:**
- `BLOCK` si exposición a un solo activo supera el 50% del portfolio
- `BLOCK` si drawdown acumulado de la semana supera el umbral configurado por el usuario
- `REDUCE` si el ratio riesgo/recompensa calculado es < 1.5
- `PASS` en cualquier otro caso — con `riskScore` informativo siempre presente

**Conocimiento base precargado:**
- Value at Risk (VaR) y Expected Shortfall para activos crypto
- Kelly Criterion para sizing óptimo de posiciones
- Correlación entre activos crypto (BTC dominance, beta de altcoins vs BTC)
- Gestión de drawdown máximo tolerable por perfil (conservador / moderado / agresivo)
- Reglas de volatilidad: ATR para ajuste de stop-loss, Bollinger Band width como señal de riesgo
- Diversificación en portfolios crypto: concentración vs distribución óptima
- Psicología del riesgo: sesgo de confirmación, FOMO, revenge trading, overtrading

---

## 4. Arquitectura del sistema

### 4.1 Arquitectura global — El orquestador como capa transversal

```
╔══════════════════════════════════════════════════════════════════════╗
║                         PLATAFORMA CRYPTOTRADER                     ║
║                                                                      ║
║   Chat (usuario)          Trading Pipeline        News Pipeline      ║
║        │                        │                       │           ║
║        ▼                        ▼                       ▼           ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │                  ORQUESTADOR (KRYPTO)                       │    ║
║  │  • Clasifica intención de chat                              │    ║
║  │  • Coordina decisiones BUY/SELL/HOLD                        │    ║
║  │  • Enriquece análisis de noticias                           │    ║
║  │  • Sintetiza respuestas cross-agente                        │    ║
║  └─────────┬──────────────┬─────────────┬──────────────┬──────┘    ║
║            │              │             │              │            ║
║            ▼              ▼             ▼              ▼            ║
║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌────────┐  ║
║  │ platform │ │operations│ │  market  │ │ blockchain │ │  risk  │  ║
║  │  NEXUS   │ │  FORGE   │ │  SIGMA   │ │   CIPHER   │ │ AEGIS  │  ║
║  └──────────┘ └──────────┘ └──────────┘ └────────────┘ └────────┘  ║
║    ↓RAG          ↓tools      ↓ctx-mkt       ↓static     ↓portfolio ║
║ pgvector DB  Trading Svc   Market Svc    Base prompts  Position DB  ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 4.2 Flujo 1 — Chat sin sub-agente seleccionado (Intent Routing)

```
Usuario abre chat → no selecciona sub-agente → escribe primer mensaje
  │
  ▼
OrchestratorService.classifyIntent(message, userId)
  │  LLM call rápido (GPT-4o-mini / Groq llama-3.3-70b)
  │  system: "Clasificar en platform|operations|market|blockchain. Responder solo JSON."
  │  user: "quiero saber qué pasará con bitcoin esta semana"
  │  → { agentId: "market", confidence: 0.97, suggestedGreeting: "Analicemos el mercado de BTC..." }
  │
  ▼
SSE event al frontend: { type: "routing", agentId: "market", greeting: "..." }
  │  Frontend muestra "KRYPTO → Analista de Mercado" (transición ~300ms)
  │
  ▼
ChatSession.agentId = "market"
  → Flujo normal de stream con sub-agente market (RAG + contexto dinámico)
```

### 4.3 Flujo 2 — Orquestación de decisión de trading

```
TradingProcessor: análisis programado para configId

1. data-fetcher → OHLCV velas + indicadores calculados
2. data-fetcher → Noticias recientes (CryptoPanic / RSS)

3. OrchestratorService.orchestrateDecision(userId, configId, indicators, news)
   │
   ├─ [PARALELO] SubAgentService.call('market', { task: 'technical_signal', indicators })   // SIGMA
   │     → { signal: 'BUY', confidence: 0.78, reasoning: "RSI 28 + MACD cruce alcista..." }
   │
   ├─ [PARALELO] SubAgentService.call('market', { task: 'news_sentiment', news })            // SIGMA
   │     → { sentiment: 0.65, impact: 'positive', reasoning: "ETF approval news dominates..." }
   │
   ├─ [PARALELO] SubAgentService.call('operations', { task: 'sizing_suggestion', config })   // FORGE
   │     → { recommendation: 'proceed', maxTradeSize: 0.04, reasoning: "3 positions open..." }
   │
   └─ [PARALELO] SubAgentService.call('risk', { task: 'risk_gate', portfolio, indicators })  // AEGIS
         → { riskScore: 42, verdict: 'PASS', positionSizeMultiplier: 1.0, alerts: [] }
   │
   ▼
   OrchestratorService.synthesizeDecision([techResult, sentimentResult, forgeResult, aegisResult], config)
     → Si aegisResult.verdict === 'BLOCK': emitir HOLD directamente, sin síntesis LLM
     → Si aegisResult.verdict === 'REDUCE': ajustar positionSize antes de síntesis
     → Llamada LLM final de síntesis:
       system: "Eres el orquestador de trading. Combina estas 4 perspectivas y emite decisión final."
       → { decision: 'BUY', confidence: 0.74, reasoning: "...", waitMinutes: 15 }

4. Decisión final → TradingService.executeIfThreshold(decision)
5. AgentDecision guardada con metadata: { orchestrated: true, subAgentResults: [...] }
```

### 4.4 Flujo 3 — Enriquecimiento de noticias

```
NewsScheduler: nuevo batch de noticias fetched

Para cada noticia relevante (score CryptoPanic > 0.5):
  OrchestratorService.enrichNews(newsItem)
  │
  ├─ [PARALELO] SubAgentService.call('market', { task: 'news_technical_relevance', headline, summary })
  │     → { relevance: 0.8, affectedIndicators: ['volume', 'RSI'], timeframe: 'short' }
  │
  └─ [PARALELO] SubAgentService.call('blockchain', { task: 'ecosystem_impact', headline, summary })
        → { ecosystemImpact: 'high', category: 'regulation', chains: ['ETH', 'BTC'] }
  │
  ▼
  NewsAnalysis guardado con campos enriquecidos:
  { score, sentiment, technicalRelevance, ecosystemImpact, tags }
  Usado después por el pipeline de trading como contexto más rico
```

### 4.5 Flujo 4 — Consulta cross-agente en chat

```
Usuario: "¿Conviene comprar ETH ahora y qué es un AMM?"
  │
  ▼
OrchestratorService.classifyIntent → { agentId: "market", crossAgent: "blockchain" }

(detectó que la consulta toca dos dominios)
  │
  ├─ [PARALELO] SubAgentService.call('market', "¿Conviene comprar ETH ahora?")
  │     → "El RSI de ETH está en 42, el MACD muestra cruce..."
  │
  └─ [PARALELO] SubAgentService.call('blockchain', "¿qué es un AMM?")
        → "Un AMM (Automated Market Maker) es un protocolo..."
  │
  ▼
OrchestratorService.synthesizeCrossAgent([marketResponse, blockchainResponse], originalQuery)
  → Respuesta unificada y fluida que integra ambas perspectivas
  → Streamed al usuario como si fuera un solo agente respondiendo
```

### 4.6 Principio de contexto limpio por sub-agente

Cada sub-agente tiene **su propio system prompt, su propio contexto dinámico y sus propios documentos RAG**. No hay contaminación cruzada de contexto entre agentes. El propósito de esto es:

1. **Precisión**: el modelo no se confunde respondiendo sobre blockchain cuando está en modo Operations.
2. **Seguridad**: el Experto en Blockchain no tiene acceso a las claves, posiciones o configuraciones del usuario.
3. **Costo**: el contexto es mínimo y específico — los tokens son costosos.

| Sub-agente | Contexto dinámico inyectado |
|-----------|---------------------------|
| `platform` (NEXUS) | onboarding_step, configs activas (solo nombres y modo), sesiones recientes |
| `operations` (FORGE) | posiciones abiertas (precio, P&L), configs activas (completas), estado del agente (running/stopped), decisiones últimas 5 |
| `market` (SIGMA) | snapshot mercado BTC/ETH (indicadores + señal + precio), últimas 10 noticias, decisiones últimas 3 |
| `blockchain` (CIPHER) | ninguno — conocimiento estático puro |
| `risk` (AEGIS) | portfolio completo (todas las posiciones abiertas, P&L acumulado, drawdown diario/semanal, exposición por activo) |

---

## 5. RAG — Retrieval-Augmented Generation

### 5.1 Estrategia seleccionada: pgvector + embeddings API

En lugar de un vector store separado (Pinecone, Weaviate, Qdrant), se usa **pgvector** como extensión de PostgreSQL (ya disponible en Railway). Esto mantiene toda la persistencia en un solo servicio, simplifica las migraciones y elimina una dependencia de terceros.

**Por qué pgvector sobre alternativas:**
- Railway soporta PostgreSQL con pgvector activado nativamente
- Búsqueda de similitud coseno O(n) es suficiente para el volumen de documentos de un admin
- Misma instancia DB — sin latencia de red adicional
- Transacciones atómicas: guardar documento + chunks + embeddings en una sola TX

**Pipeline de embeddings:**

```
Documento subido por Admin (PDF / TXT / MD)
  │
  ▼
TextExtractor (pdf-parse / markdownを-it / plain text)
  │
  ▼
ChunkSplitter
  │  chunk_size: 512 tokens
  │  chunk_overlap: 64 tokens
  │  strategy: recursive character splitting
  │
  ▼
EmbeddingService.embed(chunks[])
  │  → Voyage AI text-embedding-3 (recomendado para contenido técnico/financiero)
  │    OR OpenAI text-embedding-3-small (si el admin usa OpenAI)
  │    → vector 1536 dimensiones
  │
  ▼
AgentDocumentChunk { agentId, content, embedding: Float[] }
  → INSERT INTO agent_document_chunks con vector pgvector
```

**Búsqueda en tiempo de inferencia:**

```
userMessage
  │
  ▼
embed(userMessage) → queryVector
  │
  ▼
SELECT content, 1 - (embedding <=> queryVector) AS similarity
FROM agent_document_chunks
WHERE agent_id = $agentId
ORDER BY embedding <=> queryVector
LIMIT 5
  │
  ▼
top-5 chunks (similarity > 0.75) → inyectados en system prompt como "Documentos relevantes:"
```

### 5.2 Proveedores de embedding

| Proveedor | Modelo | Dimensiones | Costo | Cuando usar |
|-----------|--------|-------------|-------|-------------|
| **Voyage AI** | `voyage-3` | 1024 | $0.12/1M tokens | Mejor calidad para contenido técnico, el sistema default |
| **OpenAI** | `text-embedding-3-small` | 1536 | $0.02/1M tokens | Si el admin tiene OpenAI key, se reutiliza |
| **Local (Ollama)** | `nomic-embed-text` | 768 | gratis | Solo dev/self-hosted, no Railway |

> El proveedor de embedding se configura **por instancia del sistema** (variable de entorno del admin), no por usuario. `EMBEDDING_PROVIDER=voyage|openai` + `VOYAGE_API_KEY` o reutiliza `OPENAI_PLATFORM_KEY`.

---

## 6. Base de datos

### 6.1 Nuevos modelos Prisma

```prisma
// ── Enums nuevos ────────────────────────────────────────────────────────────

enum AgentId {
  platform      // NEXUS  — Experto en CryptoTrader
  operations    // FORGE  — Asistente de Operaciones
  market        // SIGMA  — Analista de Mercado
  blockchain    // CIPHER — Experto en Blockchain
  risk          // AEGIS  — Gestor de Riesgo
  orchestrator  // KRYPTO — Orquestador central
}

enum DocumentStatus {
  PENDING       // recién subido, esperando procesamiento
  PROCESSING    // chunks extrayéndose y embeddings generándose
  READY         // disponible para RAG
  ERROR         // fallo en embedding/extracción
}

// ── Definición del sub-agente (configurable por Admin) ──────────────────────

model AgentDefinition {
  id              AgentId   @id
  displayName     String
  description     String
  systemPrompt    String    @db.Text   // prompt base configurable por Admin
  skills          Json      // string[] — lista de habilidades habilitadas
  isActive        Boolean   @default(true)
  updatedAt       DateTime  @updatedAt

  documents AgentDocument[]

  @@map("agent_definitions")
}

// ── Documentos de conocimiento del agente ───────────────────────────────────

model AgentDocument {
  id          String         @id @default(cuid())
  agentId     AgentId
  title       String
  fileName    String
  mimeType    String
  sizeBytes   Int
  status      DocumentStatus @default(PENDING)
  errorMsg    String?
  uploadedAt  DateTime       @default(now())
  processedAt DateTime?
  uploadedBy  String         // userId del admin que subió el documento

  agent  AgentDefinition      @relation(fields: [agentId], references: [id])
  chunks AgentDocumentChunk[]

  @@index([agentId, status])
  @@map("agent_documents")
}

// ── Chunks con embeddings vectoriales ───────────────────────────────────────

model AgentDocumentChunk {
  id         String  @id @default(cuid())
  documentId String
  agentId    AgentId
  content    String  @db.Text
  chunkIndex Int
  // embedding vector almacenado como Unsupported para pgvector
  // en producción usar: embedding Unsupported("vector(1536)")
  embedding  Json    // Float[] — workaround hasta que Prisma soporte vector nativo

  document AgentDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([agentId])
  @@index([documentId])
  @@map("agent_document_chunks")
}

// ── Modificación a ChatSession: agrega agentId ──────────────────────────────

// ChatSession (existente en spec 17) se extiende con:
//   agentId  AgentId  @default(platform)
//
// La migración añade la columna con valor default para sesiones existentes.
```

> **Nota sobre pgvector:** El tipo `vector(1536)` requiere activar la extensión `CREATE EXTENSION IF NOT EXISTS vector` en PostgreSQL. En Railway se activa via migración SQL raw. Prisma actualmente no soporta el tipo nativo — se usa `Unsupported("vector(1536)")` en schema o se guarda como `Float[]` JSON y se hace la búsqueda por similitud en SQL raw via `$queryRaw`.

### 6.2 Migración de activación de pgvector

```sql
-- migrations/20260412000000_enable_pgvector
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE agent_document_chunks
  ADD COLUMN embedding_vec vector(1536);

CREATE INDEX ON agent_document_chunks
  USING ivfflat (embedding_vec vector_cosine_ops)
  WITH (lists = 100);
```

---

## 7. Herramientas del Asistente de Operaciones (Tool Calling)

El sub-agente `operations` puede ejecutar acciones reales en la plataforma mediante **function calling** (Claude tools / OpenAI function calling). El usuario siempre ve qué acción se va a ejecutar y debe confirmar antes de su ejecución.

### 7.1 Herramientas disponibles

```typescript
// Tool: Crear configuración de trading
{
  name: "create_trading_config",
  description: "Crea una nueva configuración de trading para el usuario",
  parameters: {
    asset: "BTC" | "ETH",
    pair: "USDT" | "USDC",
    mode: "SANDBOX" | "TESTNET" | "LIVE",
    name: string,
    buyThreshold: number,        // 0-100
    sellThreshold: number,       // 0-100
    stopLossPct: number,         // ej. 0.03 = 3%
    takeProfitPct: number,
    maxTradePct: number,
    intervalMode: "AGENT" | "CUSTOM",
    minIntervalMinutes?: number
  }
}

// Tool: Iniciar agente
{
  name: "start_agent",
  description: "Inicia el agente de trading para una configuración específica",
  parameters: {
    configId: string
  }
}

// Tool: Detener agente
{
  name: "stop_agent",
  description: "Detiene el agente de trading",
  parameters: {
    configId: string
  }
}

// Tool: Consultar posiciones abiertas
{
  name: "get_open_positions",
  description: "Devuelve las posiciones abiertas actuales del usuario",
  parameters: {}
}

// Tool: Cerrar posición manualmente
{
  name: "close_position",
  description: "Cierra manualmente una posición abierta",
  parameters: {
    positionId: string
  }
}
```

### 7.2 Protocolo de confirmación

```
Agente: "Voy a crear una configuración BTC/USDT en modo Sandbox
         con los siguientes parámetros: [tabla con valores]
         ¿Confirmas?"

Usuario: "Sí"
         ↓
Backend: ejecuta la herramienta, retorna resultado
         ↓
Agente: "✅ Config creada correctamente. ¿Quieres que inicie el agente ahora?"
```

El frontend muestra un componente especial `<ToolCallCard>` (diferente al markdown normal) con los parámetros de cada herramienta antes de ejecutarla y el resultado después.

---

## 8. Panel de Admin — Gestión de sub-agentes

### 8.1 UI en `/admin/agents`

Nueva sección en el panel de administración:

```
Admin Panel
├── Users
├── System
└── Agents ← nueva sección
    ├── Listado de sub-agentes (4 tarjetas)
    └── [Editar] → AgentEditor
```

**Listado de sub-agentes:** 4 tarjetas horizontales con:
- Avatar / color del agente
- Nombre y descripción
- Cantidad de documentos activos
- Toggle activo/inactivo
- Botón "Editar"

### 8.2 AgentEditor (por agente)

Panel de edición dividido en 3 tabs:

**Tab 1 — Identidad y Rol:**
- Campo `displayName` (editable)
- Campo `description` (editable)
- Textarea `systemPrompt` — el rol y prompt base del agente (Markdown, con preview)
- Checklist de `skills` habilitadas (cada skill tiene descripción de qué activa)

**Tab 2 — Base de conocimiento (RAG):**
- Listado de documentos con: nombre, tamaño, estado (PENDING | PROCESSING | READY | ERROR), fecha de carga
- Botón "Subir documento" → drag & drop / selector de archivo
  - Formatos aceptados: `.pdf`, `.txt`, `.md`
  - Límite: 10 MB por archivo, 50 archivos por agente
- Indicador de procesamiento por documento (barra de progreso mientras embeds se generan)
- Botón "Eliminar" por documento
- Botón "Reprocesar" si está en estado ERROR

**Tab 3 — Diagnóstico:**
- Total de chunks del agente
- Última actualización de la base de conocimiento
- Botón "Test RAG": el admin ingresa una pregunta y ve los top-5 chunks que retornaría la búsqueda semántica (sin enviar al LLM)
- Log de las últimas 10 sesiones que usaron este agente (anonimizado: userId parcial + timestamp)

### 8.3 Endpoints de admin para agentes

Todos requieren `JwtAuthGuard` + `RolesGuard(ADMIN)`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/agents` | Lista los 4 AgentDefinition |
| `GET` | `/admin/agents/:agentId` | Detalle completo de un agente + documentos |
| `PATCH` | `/admin/agents/:agentId` | Actualizar displayName, description, systemPrompt, skills |
| `GET` | `/admin/agents/:agentId/documents` | Listar documentos del agente |
| `POST` | `/admin/agents/:agentId/documents` | Upload de documento (multipart/form-data) |
| `DELETE` | `/admin/agents/:agentId/documents/:docId` | Eliminar documento + sus chunks |
| `POST` | `/admin/agents/:agentId/documents/:docId/reprocess` | Reprocesar embeddings |
| `POST` | `/admin/agents/:agentId/rag-test` | Test de búsqueda semántica |

---

## 9. Frontend — Experiencia de usuario

### 9.1 Selector de sub-agente

Al abrir el chat (widget flotante o página `/dashboard/chat`), si no hay sesión activa, se muestra el **AgentSelector**: 4 tarjetas grandes con avatar, nombre, descripción y botón "Hablar con este agente".

```
┌─────────────────────────────────────────────────────────────────┐
│  ¿Con quién quieres hablar?                                     │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐│
│  │ 📚           │  │ ⚡           │  │ 📈           │  │ 🔗     ││
│  │ Experto en  │  │ Asistente de│  │ Analista de │  │Experto ││
│  │ CryptoTrader│  │ Operaciones │  │ Mercado     │  │Blockchain││
│  │             │  │             │  │             │  │        ││
│  │ [Hablar]   │  │ [Hablar]   │  │ [Hablar]   │  │[Hablar]││
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Indicador de agente activo

Durante la conversación, el header del chat muestra el avatar + nombre del sub-agente activo. Un botón "Cambiar agente" permite iniciar una nueva sesión con otro sub-agente.

### 9.3 ToolCallCard para el Asistente de Operaciones

Cuando el sub-agente `operations` invoca una herramienta, en lugar de texto plano se renderiza una tarjeta especial:

```
┌─────────────────────────────────────────────────┐
│  ⚡ Acción pendiente de confirmar               │
│  ─────────────────────────────────────────────  │
│  Crear configuración de trading                 │
│                                                 │
│  Asset:          BTC / USDT                     │
│  Modo:           SANDBOX                        │
│  Buy threshold:  70%                           │
│  Stop loss:      3%                            │
│  Take profit:    5%                            │
│  Intervalo:      AGENT (adaptativo)             │
│                                                 │
│  [✅ Confirmar]     [❌ Cancelar]              │
└─────────────────────────────────────────────────┘
```

### 9.4 Redirección entre sub-agentes

Si el sub-agente `platform` detecta que la consulta es sobre análisis de mercado, puede responder:

> "Eso está más dentro del dominio del **Analista de Mercado**. ¿Quieres que te transfiera a él?"
> **[Sí, transferir]**

Al confirmar, se abre el AgentSelector pre-seleccionado en el agente correspondiente.

### 9.5 Componentes nuevos / modificados

```
apps/web/src/
├── components/
│   └── chat/
│       ├── agent-selector.tsx         ← NUEVO: 4 tarjetas de selección
│       ├── agent-header.tsx           ← NUEVO: header con agente activo + cambiar
│       ├── tool-call-card.tsx         ← NUEVO: confirmación de herramientas
│       ├── chat-widget.tsx            ← MODIFICAR: añade AgentSelector al estado inicial
│       ├── chat-messages.tsx          ← MODIFICAR: renderiza ToolCallCard si metadata.toolCall
│       └── chat-input.tsx             ← MODIFICAR: muestra agente activo en placeholder
│
├── pages/
│   ├── dashboard/chat.tsx             ← MODIFICAR: integra AgentSelector
│   └── admin/agents.tsx              ← NUEVO: gestión de sub-agentes
│
└── hooks/
    ├── use-chat.ts                    ← MODIFICAR: agentId en sesiones, confirmar herramientas
    └── use-admin-agents.ts           ← NUEVO: CRUD de definiciones y documentos de agentes
```

---

## 10. Flujo completo de una sesión

```
1. Usuario abre chatbot
   → AgentSelector visible (no hay sesión activa)

2. Usuario elige "Asistente de Operaciones"
   → POST /chat/sessions { agentId: "operations", provider: "CLAUDE", model: "claude-sonnet-4-20250514" }
   → ChatSession creada con agentId

3. Usuario escribe: "Quiero crear una config para tradear ETH conservadoramente"

4. POST /chat/sessions/:id/messages { content: "Quiero crear..." }
   → userMessage guardado

5. GET /chat/sessions/:id/stream?agentId=operations&content=...
   → ChatService.buildContext("operations", userId)
     → posiciones abiertas: [...], configs activas: [...], agente: stopped
   → ChatService.ragSearch("operations", "quiero crear config ETH conservadora")
     → embed query → pgvector search → top-3 chunks sobre "estrategia conservadora ETH"
   → assembleSystemPrompt(operationsAgentDef, dynamicContext, ragChunks)
   → callLLMStream con tools disponibles

6. LLM responde en streaming con tool_use:
   delta: "Perfecto, vamos a crear una config conservadora para ETH. He preparado estos parámetros:"
   tool_call: { name: "create_trading_config", params: { asset: "ETH", mode: "SANDBOX", ... } }

7. Frontend renderiza ToolCallCard con los parámetros → usuario ve "¿Confirmar?"

8. Usuario hace click en "Confirmar"
   → POST /chat/sessions/:id/tools/execute { toolName: "create_trading_config", params: {...} }
   → TradingService.createConfig(userId, params)
   → Respuesta: { success: true, config: { id: "...", name: "ETH Conservative" } }

9. SSE: "✅ Configuración creada. ¿Quieres que inicie el agente ahora?"
   → ToolCallCard de start_agent opcional
```

---

## 11. API REST — Nuevos endpoints

### `ChatController` — Extensiones

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/chat/agents` | Lista los 4 sub-agentes disponibles para el usuario |
| `POST` | `/chat/sessions` | **MODIFICAR:** añade `agentId` (opcional — si ausente, orquestador clasifica en primer mensaje) |
| `GET` | `/chat/sessions/:id/stream` | **MODIFICAR:** añade `agentId` al contexto, ejecuta RAG, pasa por orquestador si no hay agentId |
| `POST` | `/chat/sessions/:id/tools/execute` | **NUEVO:** confirmar y ejecutar Tool Call del sub-agente `operations` |

### Nuevos eventos SSE del orquestador

```typescript
// Cuando el orquestador clasifica la intención (chat sin agente seleccionado):
data: { type: "routing", agentId: "market", greeting: "Analicemos el mercado de BTC…" }

// Cuando el orquestador inicia síntesis cross-agente:
data: { type: "orchestrating", agents: ["market", "blockchain"] }

// Respuesta normal del sub-agente (sin cambio):
data: { delta: "El RSI de BTC está en..." }

// Fin del stream (sin cambio):
data: { done: true, messageId: "...", fullContent: "...", agentId: "market" }
```

### `AdminAgentsController`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/agents` | Lista los 4 sub-agentes + el orquestador con stats |
| `GET` | `/admin/agents/:id` | Detalle completo incluyendo documentos |
| `PATCH` | `/admin/agents/:id` | Editar prompt, skills, displayName (incluye orquestador) |
| `POST` | `/admin/agents/:id/documents` | Upload documento (multipart) → dispara pipeline RAG |
| `DELETE` | `/admin/agents/:id/documents/:docId` | Eliminar + chunks |
| `POST` | `/admin/agents/:id/documents/:docId/reprocess` | Re-embed |
| `POST` | `/admin/agents/:id/rag-test` | Búsqueda semántica de prueba |

---

## 12. Nuevos servicios de backend

### `OrchestratorService`

Servicio central inyectado en `ChatModule`, `TradingModule` y `AnalysisModule`.

```typescript
@Injectable()
export class OrchestratorService {
  // Chat: clasifica intención del primer mensaje
  async classifyIntent(message: string, userId: string): Promise<IntentClassification>

  // Trading: coordina 3 sub-agentes en paralelo y sintetiza decisión final
  async orchestrateDecision(
    userId: string,
    configId: string,
    indicators: IndicatorSnapshot,
    news: NewsItem[]
  ): Promise<OrchestratedDecision>

  // Noticias: enriquece cada noticia con perspectiva market + blockchain
  async enrichNews(newsItem: NewsItem): Promise<NewsEnrichment>

  // Chat: síntesis cross-agente cuando la consulta toca dos dominios
  async synthesizeCrossAgent(
    responses: SubAgentResponse[],
    originalQuery: string
  ): Promise<string>  // Streamed via SSE
}
```

### `SubAgentService`

Ejecuta llamadas a sub-agentes individuales. Compartido entre `OrchestratorService`, `ChatService` y `TradingProcessor`.

```typescript
@Injectable()
export class SubAgentService {
  // Llamada síncrona a un sub-agente (para orquestación interna — no chat)
  async call(
    agentId: AgentId,
    task: SubAgentTask,
    context: SubAgentContext,
    userId: string
  ): Promise<SubAgentResponse>

  // Llamada streaming a un sub-agente (para chat de usuario)
  stream(
    agentId: AgentId,
    message: string,
    history: ConversationMessage[],
    dynamicContext: AgentContext,
    ragChunks: string[],
    provider: LLMProvider,
    model: string,
    apiKey: string
  ): Observable<MessageEvent>
}
```

### Integración con `TradingProcessor`

El `TradingProcessor` (Bull job) que actualmente llama directamente al LLM (`callLLMStream`) ahora delega al orquestador:

```typescript
// ANTES (spec 17):
const decision = await this.llmService.analyze(indicators, news, config);

// DESPUÉS (spec 28):
const decision = await this.orchestratorService.orchestrateDecision(
  userId, configId, indicators, news
);
// El orquestador internamente llama a market (x2) + operations en paralelo y sintetiza
```

### Integración con análisis de noticias

El `NewsScheduler` que actualmente guarda noticias sin enriquecer ahora pasa por el orquestador:

```typescript
// DESPUÉS (spec 28):
for (const newsItem of freshNews) {
  const enrichment = await this.orchestratorService.enrichNews(newsItem);
  await this.prisma.newsAnalysis.create({ data: { ...newsItem, ...enrichment } });
}
```

---

## 13. Seguridad

| Riesgo | Mitigación |
|--------|-----------|
| Un usuario accede a datos de otro vía chat | `buildContext` siempre filtra por `userId` del JWT |
| El orquestador ejecuta acciones de trading silenciosamente | `orchestrateDecision` solo produce un `DecisionPayload`; la ejecución sigue siendo del `TradingService` con sus propios guards |
| El sub-agente `operations` ejecuta acciones sin confirmar | Las herramientas solo se ejecutan via `POST /tools/execute` — nunca automáticamente |
| Documentos RAG de un agente exponen info de otros agentes | `ragSearch` siempre filtra `WHERE agent_id = $agentId` |
| Upload de archivos maliciosos | Validar MIME type + extensión + tamaño server-side; no ejecutar contenido, solo extraer texto |
| SQL injection via embeddings | pgvector usa `$queryRaw` con parámetros tipados — nunca interpolación de strings |
| El sub-agente `blockchain` accede a datos de trading | `buildContext('blockchain')` retorna `{}` — cero datos de usuario |
| Costos LLM descontrolados por orquestación paralela | Calls de clasificación usan modelo barato (Groq/mini); síntesis de trading solo se ejecuta cuando el job de análisis dispara, no en cada tick |

---

## 14. Seeds de datos — `AgentDefinition` iniciales

El seed pre-crea los 5 sub-agentes **más el orquestador** (6 entradas en total) con sus system prompts base.

```typescript
// prisma/seed.ts — AgentDefinitions
const agents = [
  {
    id: 'orchestrator',
    displayName: 'KRYPTO',
    description: 'Cerebro central — clasifica intención, delega y sintetiza respuestas multi-agente',
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    skills: ['intent_classification', 'decision_synthesis', 'news_enrichment', 'cross_agent_synthesis'],
    isActive: true,
  },
  {
    id: 'platform',
    displayName: 'NEXUS',
    description: 'Tu guía personal en el uso de la plataforma CryptoTrader — cada pantalla, cada parámetro',
    systemPrompt: PLATFORM_SYSTEM_PROMPT,   // ~2000 tokens
    skills: ['platform_guide', 'indicator_explanation', 'config_help', 'agent_redirect'],
    isActive: true,
  },
  {
    id: 'operations',
    displayName: 'FORGE',
    description: 'Ejecuta configuraciones y operaciones de trading paso a paso con confirmación explícita',
    systemPrompt: OPERATIONS_SYSTEM_PROMPT, // ~2500 tokens
    skills: ['create_config', 'start_stop_agent', 'close_position', 'sizing_suggestion'],
    isActive: true,
  },
  {
    id: 'market',
    displayName: 'SIGMA',
    description: 'Análisis técnico cuantitativo en tiempo real y perspectivas del mercado crypto',
    systemPrompt: MARKET_SYSTEM_PROMPT,     // ~2000 tokens
    skills: ['technical_analysis', 'news_sentiment', 'market_perspective', 'indicator_signals'],
    isActive: true,
  },
  {
    id: 'blockchain',
    displayName: 'CIPHER',
    description: 'Del bloque génesis al ZK-rollup — todo sobre el ecosistema descentralizado',
    systemPrompt: BLOCKCHAIN_SYSTEM_PROMPT, // ~4000 tokens (el más extenso)
    skills: ['blockchain_fundamentals', 'defi_expertise', 'web3_ecosystem', 'security_guidance'],
    isActive: true,
  },
  {
    id: 'risk',
    displayName: 'AEGIS',
    description: 'Guardián del portfolio — evalúa riesgo y emite veredicto PASS/REDUCE/BLOCK antes de operar',
    systemPrompt: RISK_SYSTEM_PROMPT,       // ~1800 tokens
    skills: ['portfolio_exposure', 'drawdown_guard', 'position_sizing', 'risk_scoring'],
    isActive: true,
  },
];
```

---

## 14. Stack de librerías nuevas requeridas

| Librería | Versión | Uso |
|---------|---------|-----|
| `pdf-parse` | ^1.1.1 | Extracción de texto de PDFs en el backend |
| `@voyageai/client` | ^0.0.x | SDK Voyage AI para embeddings de alta calidad |
| `multer` | ^1.4.x | Manejo de multipart/form-data para upload en NestJS (`@nestjs/platform-express` ya incluye multer) |

> pgvector ya está disponible en Railway PostgreSQL 16 — no requiere dependencia adicional. La integración es via `prisma.$queryRaw`.

---

## 15. Fases de implementación

### Fase A — OrchestratorService + SubAgentService (backend core)
1. Crear `OrchestratorModule` en `apps/api/src/orchestrator/`
2. `SubAgentService`: llamada LLM configurable por agentId (sin RAG aún, contexto estático)
3. `OrchestratorService.classifyIntent()`: clasificación de intención de chat (primer mensaje sin agentId)
4. `OrchestratorService.orchestrateDecision()`: parallelización market×2 + operations + síntesis
5. Integrar `orchestrateDecision` en `TradingProcessor` (reemplaza la llamada LLM directa)
6. `OrchestratorService.enrichNews()`: enriquecimiento paralelo market + blockchain
7. Integrar `enrichNews` en `NewsScheduler`
8. Tests unitarios del orquestador con mocks de sub-agentes

### Fase B — RAG: AgentDefinitions + pipeline de embeddings
1. Migración `enable_pgvector` + modelos Prisma (AgentDefinition, AgentDocument, AgentDocumentChunk)
2. Seed inicial con los 6 AgentDefinitions (orquestador + 5 sub-agentes) con system prompts base
3. `EmbeddingService`: integración Voyage AI / OpenAI embeddings
4. `RagService`: ChunkSplitter + embed + búsqueda semántica con pgvector
5. `DocumentProcessorService`: upload → extracción texto → embed pipeline (Bull async)
6. `AdminAgentsController`: CRUD endpoints (incluye orquestador editable)

### Fase C — Chat: intent routing + agentId en sesiones
1. Migración: agregar `agentId` a `ChatSession` (default `null` = orquestador clasifica)
2. `ChatService`: `buildContext(agentId, userId)` con lógica por agente
3. `ChatService`: integrar `ragSearch` en flujo de stream
4. `ChatService`: intent routing via `OrchestratorService.classifyIntent()` cuando no hay `agentId`
5. `ChatService`: síntesis cross-agente para consultas multi-dominio
6. `ChatService`: function calling (tools) para sub-agente `operations`
7. Nuevos eventos SSE: `routing`, `orchestrating`
8. `POST /chat/sessions/:id/tools/execute` endpoint

### Fase D — Frontend: AgentSelector, ToolCallCard, Admin UI, indicador orquestador
1. `AgentSelector` component — 4 tarjetas + opción "Dejar que KRYPTO decida"
2. `AgentHeader` component — muestra sub-agente activo y ruta de orquestación
3. `OrchestratingIndicator` component — animación "KRYPTO coordinando…" durante síntesis
4. `ToolCallCard` component
5. Modificar `chat-widget.tsx`, `chat-messages.tsx`, `chat-input.tsx`
6. `pages/admin/agents.tsx` — gestión de los 5 agentes (orquestador editable también)
7. `use-admin-agents.ts` hook
8. Indicador visual en `BotAnalysisPage` de que la decisión fue orquestada (`orchestrated: true`)

---

## 16. Out of scope (v2)

- Agentes personalizados creados por el usuario trader (no solo admin)
- RAG sobre el historial de decisiones del usuario propio (búsqueda semántica sobre AgentDecisions)
- Memoria persistente cross-sesión (recordar preferencias del usuario entre sesiones)
- Sub-agente de email / notificaciones proactivas
- Exportar conversaciones a PDF
- Integración con APIs externas en tiempo real en los sub-agentes (ej. buscar en Google Finance)
- Orquestador con planificación de múltiples pasos (ReAct / Chain-of-Thought avanzado)
- Aprendizaje adaptativo de los agentes basado en historial de decisiones y conversaciones → **ver Spec 29**

---

## 17. Decisiones de diseño

| # | Decisión | Alternativa considerada | Razón elegida |
|---|----------|------------------------|---------------|
| 1 | pgvector sobre Pinecone | Pinecone hosted vector DB | Misma DB, sin dependencia externa, Railway lo soporta nativamente |
| 2 | Voyage AI como default embedded | OpenAI text-embedding-3 | Mejor rendimiento en contenido técnico/financiero; precio competitivo |
| 3 | 4 agentes fijos (no dinámicos) | Agentes creables por admin | Complejidad reducida; los 4 cubren todos los casos de uso relevantes |
| 4 | Confirmación explícita para tool calls | Auto-ejecución silenciosa | Principio de mínima sorpresa; el usuario nunca pierde control de sus fondos |
| 5 | Contexto limpio por agente | Contexto compartido entre sesiones | Precisión de respuestas; seguridad de datos; reducción de tokens |
| 6 | Bull queue para embedding de docs | Proceso síncrono en el request | Los PDFs grandes pueden tardar 10-30s; el usuario no debe esperar en la request |
| 7 | Chunks de 512 tokens con 64 de overlap | Chunks más grandes / sin overlap | Equilibrio entre contexto suficiente por chunk y precisión de retrieval |
| 8 | Orquestador como capa transversal (siempre presente) | Orquestador opcional / opt-in | Todo uso de IA mejora con perspectivas múltiples; la calidad de decisiones de trading justifica el costo extra de tokens |
| 9 | Modelo ligero para `classifyIntent` (Groq / GPT-4o-mini) | Mismo modelo premium para todo | Latencia <300 ms en routing; costo mínimo; clasificar intención no requiere razonamiento profundo |
| 10 | `orchestrateDecision` con llamadas paralelas (`Promise.all`) | Llamadas secuenciales a sub-agentes | Los 3 sub-agentes son independientes entre sí; paralelismo reduce latencia total de ~3× a ~1× |

---

*Próximo paso: aprobar esta spec → implementar Fase A (OrchestratorService + SubAgentService) → Fase B (RAG pipeline) → Fase C (chat integration) → Fase D (frontend + admin UI)*
