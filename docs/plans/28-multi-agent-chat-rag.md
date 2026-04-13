# Plan 28 — Sistema Multi-Agente con Orquestador, RAG y Control de Admin

**Spec:** `docs/specs/branches/28-multi-agent-chat-rag.md` (v2.1)  
**Branch:** `feature/multi-agent-chat-rag`  
**Depende de:** Spec 17 (ChatModule + SSE streaming completamente mergeado en `main`)  
**Estimación:** 4 fases, implementación secuencial

---

## Estado inicial requerido

```bash
# Verificar que main tiene ChatModule de Spec 17
grep -r "ChatModule" apps/api/src/app/app.module.ts

# Verificar que ChatSession existe en Prisma schema
grep "ChatSession" apps/api/prisma/schema.prisma

# Verificar que pgvector está disponible en la DB (Railway / Docker local)
# Si no: agregar a docker-compose.yml: image: pgvector/pgvector:pg16
```

---

## Fase A — OrchestratorModule + SubAgentService

> **Objetivo:** KRYPTO coordina decisiones de trading y enriquece noticias antes de implementar el chat multi-agente.

### A.1 Crear `OrchestratorModule`

```
apps/api/src/orchestrator/
  orchestrator.module.ts
  orchestrator.service.ts
  orchestrator.service.spec.ts
  sub-agent.service.ts
  sub-agent.service.spec.ts
  dto/
    intent-classification.dto.ts
    decision-synthesis.dto.ts
    news-enrichment.dto.ts
```

**`sub-agent.service.ts`** — interfaz interna (sin SSE, sin RAG aún):
- `call(agentId, task, context)` → respuesta síncrona de una sola LLM call
- `stream(agentId, message, context)` → AsyncGenerator<string> para SSE de chat
- Selector de system prompt por `agentId` desde `AgentDefinition` en DB
- Inyecta contexto dinámico por agente según tabla de la spec (sección 4.6)

**`orchestrator.service.ts`**:
- `classifyIntent(message, userId)` → `IntentClassification` — modelo ligero (Groq llama-3.3-70b o GPT-4o-mini)
- `orchestrateDecision(userId, configId, indicators, news)` → `DecisionPayload` — 4 llamadas paralelas: SIGMA×2 + FORGE + AEGIS
- `enrichNews(newsItem, userId)` → `NewsEnrichment` — 2 llamadas paralelas: SIGMA + CIPHER
- `synthesizeCrossAgent(queries[], userId)` → string — síntesis multi-dominio

### A.2 Integrar en `TradingProcessor`

```typescript
// apps/api/src/trading/trading.processor.ts
// Reemplazar la llamada LLM directa por:
const decision = await orchestratorService.orchestrateDecision(
  userId, configId, indicators, news
);
```

- `AgentDecision` debe guardar `metadata: { orchestrated: true, subAgentResults: [...] }`
- Agregar campo `metadata Json?` a `AgentDecision` en Prisma schema (migración)

### A.3 Integrar en `NewsAnalysisScheduler`

```typescript
// apps/api/src/market/news-analysis.scheduler.ts
// Para cada noticia con score > 0.5:
const enrichment = await orchestratorService.enrichNews(newsItem, userId);
// Guardar technicalRelevance y ecosystemImpact en NewsAnalysis
```

- Agregar campos `technicalRelevance Float?`, `ecosystemImpact String?`, `orchestratedTags Json?` a `NewsAnalysis` (migración)

### A.4 Tests Fase A

```bash
pnpm nx test api --testPathPattern="orchestrator|sub-agent"
```

- Mock de LLM calls en todos los tests
- Test `orchestrateDecision`: verificar `Promise.all` + lógica BLOCK gate de AEGIS
- Test `classifyIntent`: verificar que responde con AgentId válido
- Test `enrichNews`: verificar que llama SIGMA y CIPHER en paralelo

### A.5 Verificación

```bash
pnpm nx build api   # sin errores TS
pnpm nx test api    # verde
```

---

## Fase B — RAG: AgentDefinitions + pipeline de embeddings

> **Objetivo:** Base de conocimiento configurable por Admin para cada agente con búsqueda semántica.

### B.1 Migraciones Prisma

Agregar al `schema.prisma`:

```prisma
enum AgentId {
  platform      // NEXUS
  operations    // FORGE
  market        // SIGMA
  blockchain    // CIPHER
  risk          // AEGIS
  orchestrator  // KRYPTO
}

enum DocumentStatus {
  PENDING
  PROCESSING
  READY
  ERROR
}

model AgentDefinition { ... }    // ver spec sección 5.3
model AgentDocument { ... }      // ver spec sección 5.3
model AgentDocumentChunk { ... } // ver spec sección 5.3
```

```bash
pnpm nx run api:db-migrate -- --name add-agent-definitions-rag
```

Habilitar pgvector en la migración:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "agent_document_chunks" ADD COLUMN embedding vector(1024);
CREATE INDEX ON "agent_document_chunks" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### B.2 Seed inicial — 6 AgentDefinitions

```
apps/api/prisma/seed/agents.ts
```

Crear los 6 registros con system prompts base según spec sección 14:
- `KRYPTO` (orchestrator)
- `NEXUS` (platform)
- `FORGE` (operations)
- `SIGMA` (market)
- `CIPHER` (blockchain)
- `AEGIS` (risk)

Integrar en `apps/api/prisma/seed.ts` principal.

```bash
pnpm db:seed
```

### B.3 `EmbeddingService`

```
apps/api/src/orchestrator/embedding.service.ts
```

- `embed(texts: string[])` → `number[][]`
- Provider primario: Voyage AI `voyage-3` (1024 dims) — env `VOYAGE_API_KEY`
- Fallback: OpenAI `text-embedding-3-small` (1536 dims) — env `OPENAI_API_KEY`
- Si ninguno disponible: lanzar error descriptivo

### B.4 `RagService`

```
apps/api/src/orchestrator/rag.service.ts
```

- `ChunkSplitter.split(text, { chunkSize: 512, overlap: 64 })` → `string[]`
- `search(agentId, query, userId?, limit=5)` → `AgentDocumentChunk[]` — query pgvector con `$queryRaw`
- `buildRagContext(chunks[])` → string para inyectar en prompt

### B.5 `DocumentProcessorService`

```
apps/api/src/orchestrator/document-processor.service.ts
```

Bull queue `document-processing`:
- Job `extract-text`: `pdf-parse` para PDF, plain text para MD/TXT
- Job `embed-chunks`: split → embed en batches de 20 → INSERT `AgentDocumentChunks`
- Actualizar `AgentDocument.status` en cada transición

### B.6 `AdminAgentsController`

```
apps/api/src/admin/agents/
  admin-agents.controller.ts
  admin-agents.service.ts
  dto/
    update-agent.dto.ts
    upload-document.dto.ts
```

Endpoints (todos requieren `RolesGuard` con `UserRole.ADMIN`):
```
GET    /admin/agents                    → lista de AgentDefinitions
GET    /admin/agents/:id                → detalle + documentos
PATCH  /admin/agents/:id                → editar systemPrompt, isActive
POST   /admin/agents/:id/documents      → subir archivo (multipart/form-data)
DELETE /admin/agents/:id/documents/:docId
GET    /admin/agents/:id/documents/:docId/status
```

### B.7 Integrar RAG en `SubAgentService`

Una vez que `RagService` existe, `sub-agent.service.ts` lo usa antes de cada `stream()`:
```typescript
const ragChunks = await ragService.search(agentId, userMessage, userId);
const ragContext = ragService.buildRagContext(ragChunks);
// inyectar ragContext en el system prompt del agente
```

### B.8 Tests Fase B

```bash
pnpm nx test api --testPathPattern="embedding|rag|document-processor|admin-agents"
```

- Mock de Voyage AI / OpenAI en tests
- Mock de pgvector con `$queryRaw` stub
- Test documento: upload → PENDING → PROCESSING → READY

### B.9 Verificación

```bash
pnpm nx build api
pnpm nx test api
pnpm db:seed   # verificar que los 6 agentes existen
```

---

## Fase C — Chat: intent routing + agentId en sesiones

> **Objetivo:** El chat integra el orquestador para enrutar mensajes y el agentId persiste en la sesión.

### C.1 Migración: `agentId` en `ChatSession`

```prisma
model ChatSession {
  // ... campos existentes ...
  agentId   AgentId?   // null = orquestador clasifica en el primer mensaje
}
```

```bash
pnpm nx run api:db-migrate -- --name add-agent-id-to-chat-session
```

### C.2 Actualizar `ChatService`

```
apps/api/src/chat/chat.service.ts
```

- `buildContext(agentId, userId)` — contexto dinámico por agente (ver spec tabla 4.6)
- En primer mensaje de sesión sin `agentId`: llamar `OrchestratorService.classifyIntent()` → setear `session.agentId`
- Integrar `ragService.search()` en el flujo de stream
- Detectar `agentId` = `null` para consultas cross-agente → `OrchestratorService.synthesizeCrossAgent()`
- Function calling (tools) para FORGE: validar herramientas disponibles antes de ejecutar

### C.3 Nuevos eventos SSE

```typescript
// Agregar al SSE handler existente:
{ type: 'routing', agentId: AgentId, greeting: string }       // KRYPTO enruta
{ type: 'orchestrating', subAgents: AgentId[], step: string } // síntesis en curso
```

### C.4 `POST /chat/sessions/:id/tools/execute`

```
apps/api/src/chat/dto/execute-tool.dto.ts
```

- Validar que la sesión pertenece al usuario (guard)
- Validar que la herramienta existe y el usuario confirmó
- Ejecutar la herramienta (delegar a `TradingService` / `ConfigService` según tipo)
- Devolver resultado como SSE event `tool_result`

### C.5 Tests Fase C

```bash
pnpm nx test api --testPathPattern="chat"
```

- Test: primer mensaje sin agentId → classifyIntent llamado → session.agentId seteado
- Test: tool execution → confirm → execute → resultado guardado
- Test: SSE routing event emitido correctamente

### C.6 Verificación

```bash
pnpm nx build api
pnpm nx test api
```

---

## Fase D — Frontend: AgentSelector, ToolCallCard, Admin UI

> **Objetivo:** El usuario puede seleccionar agente, ver el routing de KRYPTO, y el admin gestiona los agentes.

### D.1 Componentes nuevos en `apps/web/src/components/chat/`

| Componente | Descripción |
|-----------|-------------|
| `AgentSelector` | 5 tarjetas (NEXUS/FORGE/SIGMA/CIPHER/AEGIS) + opción "Dejar que KRYPTO decida" |
| `AgentHeader` | Muestra agente activo con color/ícono + badge de routing si fue KRYPTO |
| `OrchestratingIndicator` | Animación "KRYPTO coordinando…" durante síntesis (GSAP) |
| `ToolCallCard` | Card de confirmación con detalles de la operación + botones Confirmar/Cancelar |

### D.2 Modificar componentes chat existentes

- `chat-widget.tsx` — integrar `AgentSelector` antes del primer mensaje, `AgentHeader` en header
- `chat-messages.tsx` — renderizar `ToolCallCard` cuando `message.type === 'tool_call'`
- `chat-input.tsx` — deshabilitar input durante `type === 'orchestrating'`

### D.3 Hooks nuevos

```
apps/web/src/hooks/use-chat-agent.ts
```

- Estado: `selectedAgentId`, `routedAgentId`, `isOrchestrating`
- Maneja eventos SSE `routing` y `orchestrating`
- Expone `selectAgent(agentId | null)`

### D.4 `pages/admin/agents.tsx`

```
apps/web/src/pages/admin/agents.tsx
```

Secciones:
- Lista de los 6 agentes con estado activo/inactivo (toggle)
- Editor de system prompt (textarea expandible, guardar con PATCH)
- Gestión de documentos: upload drag & drop, lista con status badge, eliminar
- Indicador de progreso durante procesamiento de documentos (polling `GET .../status`)

### D.5 Hook `use-admin-agents.ts`

```
apps/web/src/hooks/use-admin-agents.ts
```

TanStack Query:
- `useAgents()` — lista de agentes
- `useAgent(id)` — detalle + documentos
- `useUpdateAgent()` — mutation PATCH
- `useUploadDocument()` — mutation POST multipart
- `useDeleteDocument()` — mutation DELETE

### D.6 Rutas y i18n

- Agregar ruta `/admin/agents` (solo `UserRole.ADMIN`)
- Agregar claves i18n en `es.json` y `en.json` para todos los textos nuevos
- Agregar enlace en el menú de Admin

### D.7 Indicador en `BotAnalysisPage`

En `apps/web/src/pages/dashboard/bot-analysis.tsx`:
- Si `agentDecision.metadata?.orchestrated === true`: mostrar badge "Decisión orquestada por KRYPTO" con los sub-agentes consultados

### D.8 Tests Fase D

```bash
pnpm nx test web --testPathPattern="AgentSelector|ToolCallCard|use-chat-agent|use-admin-agents"
```

### D.9 Verificación completa

```bash
pnpm nx build api
pnpm nx build web
pnpm nx test api
pnpm nx test web
```

---

## Criterios de aceptación

- [ ] `OrchestratorService.orchestrateDecision()` llama 4 sub-agentes en paralelo y respeta BLOCK gate de AEGIS
- [ ] `OrchestratorService.classifyIntent()` enruta a uno de los 5 sub-agentes en <300ms
- [ ] pgvector habilitado y búsqueda semántica funcional para documentos de Admin
- [ ] Los 6 `AgentDefinitions` (KRYPTO, NEXUS, FORGE, SIGMA, CIPHER, AEGIS) creados vía seed
- [ ] Chat: primer mensaje sin agentId → routing automático visible en UI con animación
- [ ] Tool calling: FORGE presenta confirmación antes de ejecutar cualquier operación
- [ ] Admin puede editar system prompts y subir documentos PDF/TXT/MD
- [ ] `BotAnalysisPage` muestra badge de decisión orquestada
- [ ] Build API y Web sin errores TS
- [ ] Tests de OrchestratorService, RagService, ChatService (con agentId) en verde

---

## Cierre de branch

```bash
# Desde feature/multi-agent-chat-rag con todo verde:
git push origin feature/multi-agent-chat-rag

# PR descriptivo
cat > /tmp/pr-body-28.md << 'PREOF'
## Spec 28 — Sistema Multi-Agente con Orquestador, RAG y Control de Admin (v2.1)

### Objetivos completados
- OrchestratorModule: KRYPTO coordina decisiones de trading y análisis de noticias
- RAG con pgvector: documentos por agente con búsqueda semántica
- Chat: intent routing automático + persistencia de agentId en sesión
- AEGIS (risk) como guardián del portfolio con veredicto PASS/REDUCE/BLOCK
- Admin UI para gestión de los 6 agentes y sus documentos

### Agentes implementados
| ID | Nombre | Rol |
|----|--------|-----|
| orchestrator | KRYPTO | Orquestador central |
| platform | NEXUS | Experto en CryptoTrader |
| operations | FORGE | Asistente de Operaciones |
| market | SIGMA | Analista de Mercado |
| blockchain | CIPHER | Experto en Blockchain |
| risk | AEGIS | Gestor de Riesgo |

### Verificación
```bash
pnpm nx build api   # ✅
pnpm nx build web   # ✅
pnpm nx test api    # ✅
pnpm nx test web    # ✅
pnpm db:seed        # ✅ 6 AgentDefinitions creados
```
PREOF

gh auth switch --user e-burgos
gh pr create \
  --title "feat: multi-agent system KRYPTO+NEXUS+FORGE+SIGMA+CIPHER+AEGIS with RAG [Spec 28]" \
  --base main \
  --head feature/multi-agent-chat-rag \
  --body-file /tmp/pr-body-28.md
```

**Siguiente branch:** `feature/adaptive-agents` (Spec 29)
