# Plan 29 — Agentes Adaptativos: Memoria Episódica y Perfiles de Usuario

**Spec:** `docs/specs/branches/29-adaptive-agents.md` (v1.0)  
**Branch:** `feature/adaptive-agents`  
**Depende de:** Spec 28 completamente mergeado en `main` (OrchestratorModule, AgentId enum, pgvector habilitado)  
**Estimación:** 3 fases, implementación secuencial

---

## Estado inicial requerido

```bash
# Verificar que Spec 28 está mergeada
grep "AgentId" apps/api/prisma/schema.prisma
grep "OrchestratorModule" apps/api/src/app/app.module.ts

# Verificar que pgvector ya está habilitado (Spec 28 lo habilita)
# y que EmbeddingService ya existe
ls apps/api/src/orchestrator/embedding.service.ts
```

---

## Fase A — Memoria episódica

> **Objetivo:** Cada decisión de trading con resultado real genera un fragmento que los agentes recuperan como contexto histórico antes del siguiente ciclo.

### A.1 Migración Prisma: `AgentEpisodicMemory`

```prisma
model AgentEpisodicMemory {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  asset               String
  pair                String
  decision            Decision
  marketPhase         String
  indicatorSnapshot   Json
  newsSentiment       Float
  topHeadline         String?
  aegisRiskScore      Int
  aegisVerdict        String
  outcome             String   // 'WIN' | 'LOSS' | 'BREAKEVEN'
  pnlPercent          Float
  holdDurationHours   Float
  embeddingText       String   @db.Text
  embedding           Json     // vector pgvector (ver SQL de migración)
  createdAt           DateTime @default(now())

  @@index([userId])
  @@index([userId, asset])
  @@map("agent_episodic_memories")
}
```

SQL raw en la migración:
```sql
ALTER TABLE "agent_episodic_memories" ADD COLUMN embedding vector(1024);
CREATE INDEX ON "agent_episodic_memories" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

```bash
pnpm nx run api:db-migrate -- --name add-agent-episodic-memory
```

### A.2 `EpisodicMemoryService`

```
apps/api/src/orchestrator/episodic-memory.service.ts
apps/api/src/orchestrator/episodic-memory.service.spec.ts
```

```typescript
@Injectable()
export class EpisodicMemoryService {
  // Genera embeddingText narrativo + embeds + guarda en DB
  async recordEpisode(position: Position, decision: AgentDecision): Promise<void>

  // pgvector cosine similarity search por userId
  async getRelevantEpisodes(userId: string, context: TradingContext, limit = 5): Promise<AgentEpisodicMemory[]>

  // Formatea episodios como bloque de contexto para el prompt del orquestador
  formatEpisodesForPrompt(episodes: AgentEpisodicMemory[]): string

  // Genera el texto narrativo para embed
  private buildEmbeddingText(position: Position, decision: AgentDecision): string
}
```

**Formato `embeddingText` generado automáticamente:**
```
"Decisión {BUY|SELL|HOLD} en {ASSET}/{PAIR}. RSI {valor} ({condición}),
MACD {señal}, volumen {nivel}. Sentimiento noticias: {valor} — "{headline}".
Fase mercado: {bull|bear|sideways}. AEGIS: riskScore={n}, {PASS|REDUCE|BLOCK}.
Resultado: {GANADORA|PERDEDORA|BREAKEVEN} {+/-N}% en {X}h."
```

### A.3 Bull queue: `record-episode`

```
apps/api/src/orchestrator/processors/record-episode.processor.ts
```

- Job añadido desde `PositionService.closePosition()` vía `@InjectQueue('episodic-memory')`
- El job ejecuta `EpisodicMemoryService.recordEpisode(position, decision)`
- Async — no bloquea el cierre de posición
- Reintentos: 3 con backoff exponencial

Registrar `BullModule.registerQueue({ name: 'episodic-memory' })` en `OrchestratorModule`.

### A.4 Integrar en `OrchestratorService.orchestrateDecision()`

```typescript
// Antes de las llamadas paralelas a sub-agentes:
const episodes = await episodicMemoryService.getRelevantEpisodes(userId, { indicators, news, asset });
const episodesContext = episodicMemoryService.formatEpisodesForPrompt(episodes);

// Inyectar episodesContext en el system prompt del orquestador para la síntesis final
```

Solo inyectar si `episodes.length >= 3` (umbral mínimo de relevancia).

### A.5 Retention policy (cron)

```
apps/api/src/orchestrator/processors/memory-cleanup.processor.ts
```

- Cron diario: si un usuario tiene >500 episodios, eliminar los más antiguos
- `DELETE FROM agent_episodic_memories WHERE user_id = $1 ORDER BY created_at ASC LIMIT (count - 500)`

### A.6 Tests Fase A

```bash
pnpm nx test api --testPathPattern="episodic-memory"
```

- Test `recordEpisode`: genera embeddingText correcto para WIN y LOSS
- Test `getRelevantEpisodes`: stub pgvector, verifica query con `userId` filter
- Test integración: `closePosition` → job encolado → `recordEpisode` ejecutado
- Test `orchestrateDecision` con episodios: context inyectado en síntesis

### A.7 Verificación

```bash
pnpm nx build api
pnpm nx test api
```

---

## Fase B — Estadísticas de rendimiento por agente

> **Objetivo:** SIGMA y AEGIS conocen sus propias tasas de acierto históricas y ajustan su confianza automáticamente.

### B.1 Migración Prisma: `AgentPerformanceSnapshot`

```prisma
model AgentPerformanceSnapshot {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  agentId        AgentId
  snapshotData   Json     // SigmaPerformanceStats | AegisPerformanceStats
  calculatedAt   DateTime @default(now())

  @@unique([userId, agentId])
  @@map("agent_performance_snapshots")
}
```

```bash
pnpm nx run api:db-migrate -- --name add-agent-performance-snapshots
```

### B.2 `AgentPerformanceService`

```
apps/api/src/orchestrator/agent-performance.service.ts
apps/api/src/orchestrator/agent-performance.service.spec.ts
```

```typescript
@Injectable()
export class AgentPerformanceService {
  // Calcula stats para un agente/usuario desde AgentEpisodicMemory
  async calculateForAgent(userId: string, agentId: 'market' | 'risk'): Promise<AgentPerformanceStats>

  // Formatea stats como bloque de texto para inyectar en system prompt
  formatStatsForPrompt(agentId: AgentId, stats: AgentPerformanceStats): string

  // Bull cron: recalcula todos los snapshots cada hora
  @Cron('0 * * * *')
  async recalculateAll(): Promise<void>
}
```

**Stats por agente:**

SIGMA (`market`): win rate por tipo de señal (RSI, MACD, volumen, confluencia), mejor/peor fase de mercado.

AEGIS (`risk`): precisión de BLOCKs, tasa de falsos positivos, riskScore promedio en ganadoras vs perdedoras.

### B.3 Guard de confianza mínima

- Si `episodes < 10` para calcular stats: no inyectar — retornar `null`
- `formatStatsForPrompt()` retorna `""` si stats es null
- Evitar conclusiones estadísticas con pocos datos

### B.4 Integrar en `SubAgentService`

```typescript
// En sub-agent.service.ts, al construir el system prompt de SIGMA y AEGIS:
const stats = await agentPerformanceService.calculateForAgent(userId, agentId);
const statsContext = agentPerformanceService.formatStatsForPrompt(agentId, stats);
if (statsContext) {
  systemPrompt += `\n\n${statsContext}`;
}
```

### B.5 Endpoint Admin: performance

```
GET /admin/agents/:id/performance?userId=...
```

- Solo `UserRole.ADMIN`
- Devuelve el `snapshotData` más reciente para monitoreo

### B.6 Tests Fase B

```bash
pnpm nx test api --testPathPattern="agent-performance"
```

- Test: `calculateForAgent` con 0 episodios → retorna null
- Test: `calculateForAgent` con 15 episodios → retorna stats correctas
- Test: `formatStatsForPrompt` genera texto legible por LLM
- Test: cron recalculate no falla con DB vacía

### B.7 Verificación

```bash
pnpm nx build api
pnpm nx test api
```

---

## Fase C — Perfil de usuario persistente

> **Objetivo:** Todos los agentes conocen las preferencias del trader y adaptan sus respuestas.

### C.1 Migración Prisma: `UserAgentProfile`

```prisma
model UserAgentProfile {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  riskTolerance           String?
  preferredAssets         Json     @default("[]")
  preferredTimeframes     Json     @default("[]")
  preferredStrategies     Json     @default("[]")
  typicalTradeSizePercent Float?
  activeHoursUTC          Json?
  automationPreference    String?
  knowledgeLevel          String?
  frequentTopics          Json     @default("[]")
  profileConfidence       Float    @default(0)
  updatedAt               DateTime @updatedAt

  @@map("user_agent_profiles")
}
```

```bash
pnpm nx run api:db-migrate -- --name add-user-agent-profiles
```

### C.2 `UserProfileService`

```
apps/api/src/orchestrator/user-profile.service.ts
apps/api/src/orchestrator/user-profile.service.spec.ts
```

```typescript
@Injectable()
export class UserProfileService {
  // Obtiene o crea perfil del usuario (upsert)
  async getProfile(userId: string): Promise<UserAgentProfile>

  // Actualiza perfil desde una elección de trading (config aceptada/rechazada)
  async recordTradingChoice(userId: string, choice: ProfileChoice): Promise<void>

  // Extrae señales de una conversación completada (LLM call liviano, async)
  async extractConversationSignals(userId: string, sessionId: string): Promise<void>

  // Formatea perfil como contexto para inyectar en prompt
  // Retorna "" si profileConfidence < 0.3
  formatProfileForPrompt(profile: UserAgentProfile): string
}
```

**`ProfileChoice` enum:** `accepted_conservative_config | accepted_moderate_config | accepted_aggressive_config | rejected_config | closed_position_manually | enabled_automation | disabled_automation`

### C.3 Señal 1: elecciones de trading

Hook en `TradingService`:
```typescript
// En createTradingConfig o updateTradingConfig:
await userProfileService.recordTradingChoice(userId, inferChoiceType(config));

// En startAgent / stopAgent:
await userProfileService.recordTradingChoice(userId, 'enabled_automation' | 'disabled_automation');
```

### C.4 Señal 2: conversaciones

Bull job `extract-conversation-signals` disparado al cerrar `ChatSession`:

```typescript
// En ChatService.closeSession():
await this.conversationSignalsQueue.add('extract', { userId, sessionId });
```

El job hace una LLM call con el historial de la sesión para extraer:
```typescript
{ knowledgeSignals: string[], preferenceSignals: string[], expertiseLevel: string }
```
Estos signals actualizan `UserAgentProfile` vía `userProfileService`.

### C.5 Señal 3: comportamiento observable

Cron semanal (bajo peso, no LLM):
- Calcular `activeHoursUTC` desde timestamps de `ChatMessage` y `AgentDecision`
- Calcular `typicalTradeSizePercent` desde posiciones históricas cerradas
- Actualizar si hay >10 datos (umbral de confianza)

### C.6 Integrar en `ChatService.buildContext()`

```typescript
// Para todos los sub-agentes:
const profile = await userProfileService.getProfile(userId);
const profileContext = userProfileService.formatProfileForPrompt(profile);
// Inyectar profileContext al final del system prompt si no está vacío
```

### C.7 Integrar en `OrchestratorService.orchestrateDecision()`

```typescript
const profile = await userProfileService.getProfile(userId);
// Pasar a FORGE para ajustar sizing suggestion según riskTolerance del perfil
// Pasar a KRYPTO para síntesis final adaptada al nivel de conocimiento
```

### C.8 Frontend: indicador "Agentes aprendiendo"

En `apps/web/src/pages/dashboard/` (dashboard o settings):
```
components/AgentLearningBadge.tsx
```

- Badge informativo: "Tus agentes han procesado X decisiones — perfil {N}% completo"
- Solo visible si `profileConfidence > 0`
- Click → modal con resumen del perfil (riskTolerance, assets preferidos, etc.)

Datos desde nuevo endpoint:
```
GET /users/me/agent-profile
```

En `UsersController`, requiere auth.

### C.9 Tests Fase C

```bash
pnpm nx test api --testPathPattern="user-profile"
pnpm nx test web --testPathPattern="AgentLearningBadge"
```

- Test: `getProfile` crea perfil vacío si no existe
- Test: `recordTradingChoice` con `accepted_conservative_config` → `riskTolerance = conservative`
- Test: `formatProfileForPrompt` retorna `""` si `profileConfidence < 0.3`
- Test: `extractConversationSignals` → Bull job encolado (no ejecutar LLM real en test)

### C.10 Verificación completa

```bash
pnpm nx build api
pnpm nx build web
pnpm nx test api
pnpm nx test web
```

---

## Criterios de aceptación

- [ ] `AgentEpisodicMemory` se crea automáticamente al cerrar una posición con AgentDecision asociada
- [ ] `OrchestratorService.orchestrateDecision()` inyecta episodios relevantes como contexto cuando hay ≥3 episodios similares
- [ ] `AgentPerformanceSnapshot` se recalcula hourly para SIGMA y AEGIS
- [ ] Stats de rendimiento inyectadas en system prompt solo cuando hay ≥10 episodios base
- [ ] `UserAgentProfile` se construye progresivamente desde las 3 señales
- [ ] Perfil injected en todos los sub-agentes cuando `profileConfidence ≥ 0.3`
- [ ] `AgentLearningBadge` visible en dashboard con conteo de decisiones procesadas
- [ ] Retention policy: máximo 500 episodios por usuario
- [ ] Aislamiento total: ninguna query de memoria/perfil devuelve datos de otro userId
- [ ] Build API y Web sin errores TS
- [ ] Tests en verde

---

## Cierre de branch

```bash
git push origin feature/adaptive-agents

cat > /tmp/pr-body-29.md << 'PREOF'
## Spec 29 — Agentes Adaptativos: Memoria Episódica y Perfiles de Usuario

### Objetivos completados
- Memoria episódica: fragmentos de decisiones con outcome real, recuperados por similitud semántica
- Estadísticas de rendimiento: SIGMA y AEGIS conocen sus tasas de acierto históricas
- Perfil de usuario: preferencias construidas desde elecciones, conversaciones y comportamiento
- Modelo de privacidad híbrido: datos por-usuario estrictamente aislados

### Mecanismos implementados
| Mecanismo | Servicio | Trigger |
|-----------|---------|---------|
| Memoria episódica | EpisodicMemoryService | Position.closePosition → Bull job |
| Stats de rendimiento | AgentPerformanceService | Cron hourly |
| Perfil de usuario | UserProfileService | TradingChoice + ChatSession.close + Cron weekly |

### Verificación
```bash
pnpm nx build api   # ✅
pnpm nx build web   # ✅
pnpm nx test api    # ✅
pnpm nx test web    # ✅
```
PREOF

gh auth switch --user e-burgos
gh pr create \
  --title "feat: adaptive agents — episodic memory, performance stats, user profiles [Spec 29]" \
  --base main \
  --head feature/adaptive-agents \
  --body-file /tmp/pr-body-29.md
```

**Siguiente branch:** a definir (Spec 30 pendiente de diseño)
