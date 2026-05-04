# Plan 41 — Orchestrator: Distribución de Inputs Enriquecidos a Sub-agentes

**Spec:** docs/specs/branches/41-orchestrator-enriched-inputs.md  
**Branch:** `feature/orchestrator-enriched-inputs`  
**Depende de:** Spec 40 mergeada en main (feature/market-data-sources)

---

## Estado inicial requerido

```bash
# Verificar que Spec 40 está mergeada
git log main --oneline | head -5
# Debe incluir commits de market-data-sources

# Verificar que el orchestrator actual funciona
grep "enrichedData" apps/api/src/orchestrator/orchestrator.service.ts
# Debe encontrar la distribución cruda actual

# Verificar sub-agents existentes
grep "SubAgentId" apps/api/src/orchestrator/sub-agent.service.ts
# Debe listar: platform, operations, market, blockchain, risk, orchestrator

# Verificar AgentTask existentes
grep "AgentTask" apps/api/src/orchestrator/sub-agent.service.ts
# Debe incluir: technical_signal, news_sentiment, sizing_suggestion, risk_gate, etc.
```

---

## Fase A — Backend: Distribución de inputs + CIPHER macro_context

### A.1 — Agregar `macro_context` a `AgentTask`

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts`

- Agregar `'macro_context'` al type `AgentTask`

### A.2 — Crear prompt de CIPHER para `macro_context`

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts`

- Actualizar el system prompt de `blockchain` (CIPHER) en `AGENT_SYSTEM_PROMPTS` para incluir su nuevo rol de análisis macro en decisiones de trading
- Agregar formato JSON de respuesta para `macro_context`

### A.3 — Agregar `buildTaskUserPrompt` para `macro_context`

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts`

- Agregar case `'macro_context'` en `buildTaskUserPrompt()`
- Construir prompt con secciones condicionales: Global Market, DeFi Health, Token Unlocks
- Solo incluir secciones que tengan datos

### A.4 — Modificar prompts de `technical_signal`

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts`

- Modificar case `'technical_signal'` en `buildTaskUserPrompt()` para aceptar `context.externalSignals` opcional
- Agregar instrucción de confluencia/divergencia al system prompt de SIGMA

### A.5 — Modificar prompts de `news_sentiment`

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts`

- Modificar case `'news_sentiment'` para aceptar `context.fearGreed` y `context.predictions` opcionales
- Agregar instrucción al system prompt de SIGMA para integrar estos datos

### A.6 — Modificar prompts de `risk_gate`

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts`

- Modificar case `'risk_gate'` para aceptar `context.derivatives` opcional
- Agregar instrucciones de umbrales de riesgo sistémico al system prompt de AEGIS

### A.7 — Modificar `orchestrateDecision()` — Distribución

**Archivo:** `apps/api/src/orchestrator/orchestrator.service.ts`

- Distribuir `enrichedData` a los sub-agentes según categoría:
  - `technicalSignals` → SIGMA (technical_signal) como `externalSignals`
  - `fearGreed` + `predictions` → SIGMA (news_sentiment)
  - `globalMarket` + `defiHealth` + `tokenUnlocks` → CIPHER (macro_context) — condicional
  - `derivatives` → AEGIS (risk_gate) como `derivatives`
- Agregar llamada condicional a CIPHER: solo si hay al menos un dato macro
- Agregar CIPHER a `subAgentResults` cuando se ejecute

### A.8 — Simplificar `decision_synthesis`

**Archivo:** `apps/api/src/orchestrator/sub-agent.service.ts`

- Modificar case `'decision_synthesis'` para:
  - Eliminar bloque `externalDataSources` (JSON crudo)
  - Agregar `context.macroContext` condicional (output limpio de CIPHER)

**Archivo:** `apps/api/src/orchestrator/orchestrator.service.ts`

- Eliminar `externalDataSources` del contexto de síntesis
- Agregar `macroContext: cipherOutput` si CIPHER fue ejecutado

### A.9 — DTO MacroContextOutput

**Archivo:** `apps/api/src/orchestrator/dto/macro-context.dto.ts` (nuevo)

```typescript
export interface MacroContextOutput {
  regime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  keyFactors: string[];
  reasoning: string;
}
```

### A.10 — Tests unitarios

**Archivo:** `apps/api/src/orchestrator/orchestrator.service.spec.ts`

- Test: `orchestrateDecision` con enrichedData completo → 5 sub-agent calls + synthesis
- Test: `orchestrateDecision` sin enrichedData → 4 sub-agent calls + synthesis (como antes)
- Test: `orchestrateDecision` con enrichedData parcial (solo fearGreed) → 4 calls (sin CIPHER) + synthesis
- Test: `orchestrateDecision` con enrichedData parcial (solo globalMarket) → 5 calls (con CIPHER) + synthesis
- Test: `decision_synthesis` ya NO recibe `externalDataSources`
- Test: CIPHER call incluye datos macro en el context
- Test: AEGIS call incluye derivatives cuando disponible

### Verificación Fase A

```bash
pnpm nx test api --testPathPattern=orchestrator
pnpm nx build api
```

---

## Fase B — Frontend: AgentInputSummary reestructurado

### B.1 — Agregar grupo "Contexto Macro" condicional

**Archivo:** `apps/web/src/components/bot-analysis/agent-input-summary.tsx`

- Renombrar grupo actual "Fuentes Externas" a "Contexto Macro"
- Mostrar: Régimen de mercado, DeFi TVL, Global MCap, Token Unlocks
- Solo mostrar si `enrichedSnapshot` tiene datos macro (globalMarket || defiHealth || tokenUnlocks)
- Si no hay datos macro → omitir el grupo completamente

### B.2 — Mover datos al sub-agente correspondiente

**Archivo:** `apps/web/src/components/bot-analysis/agent-input-summary.tsx`

- Fear & Greed → mover al grupo "Noticias" (junto a sentimiento de SIGMA)
- Derivatives → agregar info resumida en footer tags de riesgo (ya está AEGIS)
- altfins → si disponible, agregar nota de confluencia en grupo "Indicadores"

### B.3 — i18n keys

**Archivos:** `apps/web/src/locales/en.ts`, `apps/web/src/locales/es.ts`

- Agregar keys para grupo "Macro Context" / "Contexto Macro"
- Agregar keys para régimen, bias, confluence

### B.4 — Verificación degradación graceful en UI

- Sin sources → no aparece grupo macro, no aparecen datos en otros grupos
- Con sources parciales → solo aparecen datos disponibles
- Con todos los sources → card completa

### Verificación Fase B

```bash
pnpm nx build web
pnpm nx test web
```

---

## Fase C — E2E y verificación

### C.1 — Test E2E: decisión con todas las fuentes activas

- Verificar que se llaman 5 sub-agents
- Verificar que synthesis recibe 5 outputs limpios
- Verificar que NO hay JSON crudo de externalDataSources en el prompt de synthesis

### C.2 — Test E2E: decisión sin fuentes externas

- Desactivar todos los data sources
- Verificar que se llaman 4 sub-agents (sin CIPHER macro)
- Verificar que el flujo funciona exactamente como antes de esta spec

### C.3 — Test E2E: decisión con fuentes parciales

- Activar solo Fear & Greed (→ SIGMA sentiment lo usa, CIPHER NO se llama)
- Activar solo Global Market (→ CIPHER SE llama)
- Verificar cada combinación

### C.4 — Verificar reducción de tokens

- Comparar longitud del prompt de synthesis antes/después
- El JSON crudo eliminado debería reducir ~500-2000 tokens por decisión

### Verificación Fase C

```bash
pnpm nx e2e web-e2e
# o tests manuales contra el entorno de desarrollo
```

---

## Criterios de aceptación

- [ ] `macro_context` registrado como AgentTask y funcional
- [ ] CIPHER se llama condicionalmente solo cuando hay datos macro
- [ ] SIGMA (technical) recibe altfins como confirmación opcional
- [ ] SIGMA (sentiment) recibe Fear & Greed y Predictions opcionales
- [ ] AEGIS (risk_gate) recibe Derivatives opcionales
- [ ] El prompt de synthesis ya NO contiene JSON crudo de fuentes externas
- [ ] Synthesis recibe 4 outputs (sin sources) o 5 outputs (con sources macro)
- [ ] Sin regresión: bot funciona correctamente con 0 sources activos
- [ ] Tests del orchestrator pasan con y sin enrichedData
- [ ] UI card refleja la nueva distribución de inputs por sub-agente
- [ ] Build sin errores: `pnpm nx build api && pnpm nx build web`

---

## Cierre de branch

```bash
git add -A && git commit -m "feat(orchestrator): distribute enriched inputs to sub-agents — Spec 41"
git push origin feature/orchestrator-enriched-inputs

gh pr create \
  --base main \
  --head feature/orchestrator-enriched-inputs \
  --title "feat: Orchestrator — Distribute Enriched Inputs to Sub-agents (Spec 41)" \
  --body "## Spec 41 — Orchestrator Enriched Inputs Distribution

### Resumen
Redistribuye los inputs de fuentes externas (Spec 40) a los sub-agentes según su rol, en vez de pasarlos crudos al sintetizador.

### Cambios principales
- **SIGMA (technical):** recibe altfins signals como confirmación/contradicción
- **SIGMA (sentiment):** recibe Fear & Greed + Predictions
- **CIPHER (macro_context):** nuevo task — analiza Global Market + DeFi + Token Unlocks → régimen de mercado
- **AEGIS (risk_gate):** recibe Derivatives (funding, OI, liquidations)
- **Synthesis:** solo recibe outputs limpios, cero JSON crudo

### Degradación graceful
- Sin fuentes externas: 4 sub-agents (como antes)
- Con fuentes parciales: cada agente usa lo que hay disponible
- Con todas las fuentes: 5 sub-agents → outputs limpios → synthesis

### Testing
- Tests unitarios orchestrator con/sin enrichedData
- E2E: flujo completo en cada escenario de disponibilidad

**Spec:** docs/specs/branches/41-orchestrator-enriched-inputs.md
**Plan:** docs/plans/41-orchestrator-enriched-inputs.md"
```
