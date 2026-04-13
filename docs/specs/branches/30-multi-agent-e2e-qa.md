# Spec 30 — QA End-to-End del Sistema Multi-Agente (Spec 28)

**Fecha:** 2026-04-13  
**Versión:** 1.1  
**Estado:** Propuesto  
**Branch:** `feature/multi-agent-e2e-qa`  
**Dependencias:** Spec 28 (multi-agent-chat-rag, implementado en `feature/multi-agent-chat-rag`)

---

## 1. Resumen ejecutivo

Esta spec define la estrategia completa de QA para validar la implementación de Spec 28 (Sistema Multi-Agente con Orquestador, RAG y Control de Admin). El objetivo es:

1. **Abrir un navegador interno compartido** entre el agente y Playwright para detectar errores de consola y problemas de UI en tiempo real.
2. **Construir una suite E2E exhaustiva** con Playwright que cubre todos los casos de uso de Spec 28 punta a punta.
3. **Ciclo fix-verificar**: por cada error encontrado (back o front), aplicar el fix y re-validar de forma incremental.
4. **Orquestación de infra**: levantar y apagar apps y servicios de forma controlada para validaciones progresivas.

---

## 2. Alcance de los tests

### 2.1 Módulos a testear (todos de Spec 28)

| Módulo                            | Casos de uso                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| **AgentSelector**                 | Seleccionar cada uno de los 5 sub-agentes; opción "Dejar que KRYPTO decida"             |
| **Intent Routing (KRYPTO)**       | Sin agente seleccionado → routing automático → SSE `routing` event visible              |
| **Chat por sub-agente**           | Conversación fluida con NEXUS, FORGE, SIGMA, CIPHER, AEGIS; streaming de tokens         |
| **RAG en chat**                   | Respuestas informadas por documentos subidos; verificar que el contexto del RAG aparece |
| **Tool Calling (FORGE)**          | FORGE propone acción → `ToolCallCard` visible → Confirmar → ejecutar → resultado        |
| **Tool Calling (FORGE)**          | Cancelar acción → NO ejecutar → chat sigue activo                                       |
| **Orquestación de trading**       | `AgentDecision` tiene `metadata.orchestrated: true` en Bot Analysis page                |
| **Cross-agent synthesis**         | Consulta multi-dominio → `OrchestratingIndicator` visible → respuesta unificada         |
| **Admin — lista de agentes**      | `/admin/agents` carga 6 tarjetas con nombre, estado, docs                               |
| **Admin — editar system prompt**  | Editar y guardar system prompt de SIGMA → validar PATCH guardado                        |
| **Admin — subir documento**       | Subir PDF/TXT/MD → status PENDING → PROCESSING → READY                                  |
| **Admin — eliminar documento**    | Eliminar documento → chunks eliminados → no aparece en lista                            |
| **Admin — Test RAG**              | Input consulta → devuelve top-5 chunks con similarity score                             |
| **Cambiar agente en chat**        | Botón "Cambiar agente" → nuevo AgentSelector → nueva sesión                             |
| **Redirección entre sub-agentes** | NEXUS redirige a SIGMA → usuario confirma → sesión con SIGMA                            |
| **Consola libre de errores**      | Ninguna de las acciones anteriores genera errores JS en consola                         |

### 2.2 Fuera de scope

- Tests de carga / performance del pipeline de trading orquestado
- Tests de embedding quality (cobertura semántica real del RAG)
- Tests de la API de Binance real (todos en modo SANDBOX)
- Visual regression screenshots baseline

---

## 3. Arquitectura del test runner

### 3.1 Archivo principal del spec

```
e2e/
  multi-agent-chat.spec.ts       ← suite principal (todos los bloques)
  multi-agent-admin.spec.ts      ← suite admin: agentes + RAG + documentos
  multi-agent-trading.spec.ts    ← suite orquestación de trading
```

### 3.2 Page Objects

```
e2e/
  page-objects/
    chat-page.ts         ← locators y acciones del chat widget + página /dashboard/chat
    agent-selector.ts    ← locators del AgentSelector
    tool-call-card.ts    ← locators del ToolCallCard (confirm/cancel)
    admin-agents-page.ts ← locators del panel /admin/agents
```

### 3.3 Fixtures

Dos tipos de archivo de sesión autenticada (`storageState`):

```
e2e/.auth/
  admin.json     ← sesión de admin@crypto.com (rol ADMIN) — generada por global.setup
  trader.json    ← sesión de trader@crypto.com (rol TRADER) — generada por global.setup
```

```typescript
// e2e/fixtures/agent-fixtures.ts
export const fixtures = base.extend({
  chatPage:        async ({ page }, use) => { ... },
  adminAgentsPage: async ({ page }, use) => { ... },
});

// Proyectos Playwright:
//   chromium-admin   → storageState: 'e2e/.auth/admin.json'
//   chromium-trader  → storageState: 'e2e/.auth/trader.json'
//   headed-debug     → headed: true, slowMo: 400 — BROWSER EN TIEMPO REAL
```

### 3.4 Usuarios de prueba

| Rol    | Email               | Password      | Tiene acceso a                           |
| ------ | ------------------- | ------------- | ---------------------------------------- |
| ADMIN  | `admin@crypto.com`  | `Admin1234!`  | Chat + `/admin/agents` + Bot Analysis    |
| TRADER | `trader@crypto.com` | `Trader1234!` | Chat + Bot Analysis (NO `/admin/agents`) |

### 3.5 Datos de prueba

| Dato                        | Valor                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| Documento de prueba         | `e2e/fixtures/test-doc.md` (incluido en repo)                        |
| Consulta de intención clara | `"¿Cómo configuro el stop loss del agente?"` → NEXUS                 |
| Consulta market             | `"¿Cuál es el RSI actual de BTC?"` → SIGMA                           |
| Consulta cross-domain       | `"¿Conviene comprar ETH ahora y qué es un AMM?"` → market+blockchain |

### 3.6 Matriz de roles por bloque

Cada bloque indica qué usuario(s) lo ejecutan y qué comportamientos difieren:

| Bloque | Descripción                       | ADMIN | TRADER | Diferencia de comportamiento          |
| ------ | --------------------------------- | :---: | :----: | ------------------------------------- |
| 1      | AgentSelector                     |  ✅   |   ✅   | Ninguna — acceso idéntico             |
| 2      | Intent Routing de KRYPTO          |  ✅   |   ✅   | Ninguna                               |
| 3      | Chat por sub-agente               |  ✅   |   ✅   | Ninguna — ambos chatean               |
| 4      | RAG en chat                       |  ✅   |   ✅   | Admin sube el doc; Trader solo lo usa |
| 5      | Tool Calling (FORGE)              |  ✅   |   ✅   | Ambos pueden confirmar tools          |
| 6      | Cross-agent synthesis             |  ✅   |   ✅   | Ninguna                               |
| 7      | Admin — gestión de agentes        |  ✅   |   ❌   | TRADER recibe 403/redirect            |
| 7b     | Control de acceso `/admin/agents` |   —   |   ✅   | TRADER no puede entrar                |
| 8      | BotAnalysis decisión orquestada   |  ✅   |   ✅   | Cada uno ve sus propias decisiones    |
| 9      | Smoke global (consola limpia)     |  ✅   |   ✅   | Se ejecuta con ambos usuarios         |

---

## 4. Metodología de testing progresivo

### 4.1 Browser interno compartido — tiempo real

Durante la sesión de QA, el agente ejecuta los tests en **modo headed** (browser visible) para observar e interactuar en tiempo real:

```bash
# Modo headed — browser visible, slowMo para poder seguir la ejecución
pnpm playwright test e2e/multi-agent-chat.spec.ts \
  --headed \
  --slowMo=400 \
  --project=headed-debug

# Con inspector de Playwright abierto (pausa en cada step)
PWDEBUG=1 pnpm playwright test e2e/multi-agent-chat.spec.ts --headed
```

El proyecto `headed-debug` en `playwright.config.ts` tiene:

```typescript
{
  name: 'headed-debug',
  use: {
    ...devices['Desktop Chrome'],
    headless: false,
    slowMo: 400,
    // Alterna entre admin y trader según el bloque:
    storageState: 'e2e/.auth/admin.json',  // o trader.json
  },
}
```

**Qué observa el agente en tiempo real:**

1. Apertura del browser en `http://localhost:4200`
2. Cada navegación, click e input visible paso a paso
3. Errores de consola en el devtools del browser abierto
4. Screenshots automáticos ante cualquier fallo (`screenshot: 'on'`)
5. Grabación de video para fallos complejos (`video: 'retain-on-failure'`)

```typescript
// Patrón de monitoreo de consola — incluido en TODOS los tests:
test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    throw new Error(`[PAGE ERROR] ${err.message}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.warn(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });
});
```

### 4.2 Ciclo incremental fix → verify

```
1. Levantar infra (docker-compose: postgres + redis + pgvector)
2. Levantar backend (nx serve api)
3. Correr seed (pnpm db:seed)
4. Levantar frontend (nx serve web)
5. Ejecutar BLOQUE de tests
6. Por cada test FAIL:
   a. Analizar error (consola + logs backend)
   b. Aplicar fix (back o front)
   c. Re-levantar app afectada
   d. Re-ejecutar solo ese test
   e. Cuando verde → continuar al siguiente BLOQUE
7. Cerrar infra al finalizar
```

### 4.3 Comandos de control de infra

```bash
# Levantar infra completa (DB + Redis)
docker compose up -d postgres redis

# Levantar solo backend
pnpm nx serve api

# Levantar solo frontend
pnpm nx serve web

# Seed inicial
pnpm db:seed

# Correr solo un bloque de tests
pnpm nx e2e web-e2e -- --grep "BLOQUE 1"

# Correr suite completa multi-agente
pnpm nx e2e web-e2e -- --grep "multi-agent"

# Ver reporte HTML
pnpm playwright show-report
```

---

## 5. Casos de uso detallados por bloque

### BLOQUE 1 — AgentSelector y navegación inicial `[AMBOS USUARIOS]`

```
[ADMIN]  1.1 Abrir /dashboard/chat → AgentSelector visible con 5 tarjetas
[TRADER] 1.1 Abrir /dashboard/chat → AgentSelector visible con 5 tarjetas
[AMBOS]  1.2 Click "Hablar con NEXUS" → header muestra "NEXUS"
[AMBOS]  1.3 Click "Hablar con SIGMA" → header muestra "SIGMA"
[AMBOS]  1.4 Click "Hablar con FORGE" → header muestra "FORGE"
[AMBOS]  1.5 Click "Hablar con CIPHER" → header muestra "CIPHER"
[AMBOS]  1.6 Click "Hablar con AEGIS" → header muestra "AEGIS"
[AMBOS]  1.7 Click "Dejar que KRYPTO decida" → sin agente activo → primer mensaje activa routing
```

### BLOQUE 2 — Intent Routing de KRYPTO `[AMBOS USUARIOS]`

```
[AMBOS]  2.1 Mensaje sobre plataforma → routing a platform (NEXUS)
[AMBOS]  2.2 Mensaje sobre mercado → routing a market (SIGMA)
[AMBOS]  2.3 Mensaje sobre blockchain → routing a blockchain (CIPHER)
[AMBOS]  2.4 Animación de routing visible durante ~300ms antes de iniciar stream
[AMBOS]  2.5 Después del routing → ChatSession.agentId correcto (verificar API GET /chat/sessions/:id)
```

### BLOQUE 3 — Chat con cada sub-agente `[AMBOS USUARIOS]`

Cada test se ejecuta dos veces: una como ADMIN y una como TRADER. El comportamiento debe ser idéntico.

```
[AMBOS]  3.1 NEXUS responde sobre configuración de stop-loss de la plataforma
[AMBOS]  3.2 SIGMA responde con contexto de mercado (RSI, indicadores)
[AMBOS]  3.3 FORGE responde sobre estrategia BTC/USDT
[AMBOS]  3.4 CIPHER responde sobre qué es un AMM
[AMBOS]  3.5 AEGIS responde sobre exposición máxima de portfolio
[AMBOS]  3.6 Streaming visible — tokens llegan progresivamente
[AMBOS]  3.7 Sin errores de consola al chatear como cualquier usuario
```

### BLOQUE 4 — RAG en chat `[ADMIN sube doc / TRADER lo usa]`

```
[ADMIN]  4.1 Admin sube test-doc.md al agente NEXUS desde /admin/agents
[ADMIN]  4.2 Esperar status READY (polling hasta 30s)
[ADMIN]  4.3 Admin pregunta sobre ATR al NEXUS → respuesta incluye info del doc
[TRADER] 4.4 Trader pregunta lo mismo al NEXUS → también recibe respuesta contextualizada por el doc
[ADMIN]  4.5 Test RAG en admin: consulta → devuelve top-5 chunks visibles
```

### BLOQUE 5 — Tool Calling (FORGE) `[AMBOS USUARIOS]`

```
[AMBOS]  5.1 Chat con FORGE → pedir crear config BTC/USDT Sandbox
[AMBOS]  5.2 ToolCallCard visible con parámetros de la operación
[AMBOS]  5.3 Click "Confirmar" → acción ejecutada → mensaje de éxito
[AMBOS]  5.4 Verificar config creada en /dashboard/config
[AMBOS]  5.5 Chat con FORGE → pedir detener agente activo
[AMBOS]  5.6 Click "Cancelar" en ToolCallCard → NO ejecuta → chat sigue activo
[AMBOS]  5.7 Agente NOT detenido (verificar estado)
```

### BLOQUE 6 — Cross-agent synthesis `[AMBOS USUARIOS]`

```
[AMBOS]  6.1 Enviar consulta multi-dominio (ETH + AMM)
[AMBOS]  6.2 OrchestratingIndicator visible ("KRYPTO coordinando...")
[AMBOS]  6.3 Respuesta final integra perspectiva de market Y blockchain
[AMBOS]  6.4 Sin errores de consola durante la síntesis
```

### BLOQUE 7 — Admin: gestión de agentes `[SOLO ADMIN]`

```
[ADMIN]  7.1 /admin/agents carga con 6 tarjetas (KRYPTO, NEXUS, FORGE, SIGMA, CIPHER, AEGIS)
[ADMIN]  7.2 Toggle activo/inactivo de un agente → cambio persistido (PATCH)
[ADMIN]  7.3 Click Editar SIGMA → tabs Identidad/Conocimiento/Diagnóstico visibles
[ADMIN]  7.4 Editar system prompt → guardar → reload → mismo texto
[ADMIN]  7.5 Subir test-doc.md → status PENDING → PROCESSING → READY (polling)
[ADMIN]  7.6 Eliminar documento → no aparece en lista → chunks eliminados
[ADMIN]  7.7 Test RAG: input pregunta → aparecen chunks con score
```

### BLOQUE 7b — Control de acceso `[SOLO TRADER]`

```
[TRADER] 7b.1 Trader intenta acceder a /admin/agents → redirigido a /dashboard (403 o redirect)
[TRADER] 7b.2 Trader llama GET /api/admin/agents con su JWT → recibe 403 Forbidden
[TRADER] 7b.3 Trader llama PATCH /api/admin/agents/market → recibe 403 Forbidden
```

### BLOQUE 8 — Bot Analysis: decisión orquestada `[AMBOS USUARIOS]`

```
[AMBOS]  8.1 Navegar a /dashboard/bot-analysis
[AMBOS]  8.2 Si hay AgentDecisions con metadata.orchestrated: true → badge visible
[AMBOS]  8.3 Badge muestra sub-agentes consultados (SIGMA, FORGE, AEGIS)
[ADMIN]  8.4 Admin ve decisiones de cualquier config (si tiene acceso global)
[TRADER] 8.4 Trader ve solo sus propias decisiones
```

### BLOQUE 9 — Smoke test global (consola limpia) `[AMBOS USUARIOS]`

```
[ADMIN]  9.1 Navegar /dashboard/chat → sin errores JS
[ADMIN]  9.2 Navegar /admin/agents → sin errores JS
[ADMIN]  9.3 Navegar /dashboard/bot-analysis → sin errores JS
[TRADER] 9.4 Navegar /dashboard/chat → sin errores JS
[TRADER] 9.5 Navegar /dashboard/bot-analysis → sin errores JS
[TRADER] 9.6 Navegar /admin/agents → redirige, sin errores JS
[AMBOS]  9.7 No hay peticiones HTTP 4xx/5xx en flujos normales
[AMBOS]  9.8 SSE connections no se cierran inesperadamente
```

---

## 6. Documento de fixtures

```markdown
<!-- e2e/fixtures/test-doc.md -->

# Guía de configuración avanzada de stop-loss en CryptoTrader

## Stop-loss dinámico con ATR

El stop-loss automático de CryptoTrader usa el indicador ATR (Average True Range)
multiplicado por un factor configurable (por defecto: 2.0) para calcular el nivel
de stop-loss adaptativo según la volatilidad del mercado.

### Parámetros recomendados

| Perfil      | ATR Multiplier | Max Stop-Loss |
| ----------- | -------------- | ------------- |
| Conservador | 1.5x           | 2%            |
| Moderado    | 2.0x           | 3%            |
| Agresivo    | 3.0x           | 5%            |

## Trailing Stop-Loss

La plataforma soporta trailing stop-loss: el nivel de stop se ajusta
automáticamente conforme el precio sube, asegurando ganancias.
```

---

## 7. Criterios de aceptación

- [ ] Suite completa ejecuta sin FAIL en entorno local con infra Docker
- [ ] Cero errores de consola JavaScript para **ambos usuarios** (ADMIN y TRADER)
- [ ] Intent routing de KRYPTO produce el agentId correcto para ADMIN y TRADER en > 90% de casos
- [ ] ToolCallCard visible antes de cualquier acción destructiva (FORGE) — verificado con ambos roles
- [ ] Admin puede subir/eliminar documentos y el estado se refleja correctamente
- [ ] Trader recibe respuestas informadas por documentos subidos por Admin (RAG transversal)
- [ ] Trader recibe 403/redirect al intentar acceder a `/admin/agents` (control de acceso)
- [ ] Test RAG devuelve chunks relevantes para una pregunta sobre el documento subido
- [ ] `AgentDecisions` orquestadas muestran badge en BotAnalysisPage para ambos roles
- [ ] `headed-debug` project en playwright.config.ts permite ver los tests en tiempo real
- [ ] Build API y Web sin errores TS después de todos los fixes aplicados
- [ ] `pnpm nx e2e web-e2e` termina en verde con los specs de Spec 30

---

## 8. Out of scope

- Tests de agentes adaptativos (Spec 29) — serán cubiertos en spec separada
- Pruebas con API key real de Binance (solo SANDBOX/TESTNET)
- Performance benchmarks de LLM (latencia P99 de sub-agentes)
- Tests en Firefox o Safari (solo Chromium en esta spec)

---

## 9. Decisiones de diseño

| Decisión                                                           | Razón                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Dos archivos de auth separados (`admin.json` / `trader.json`)      | Permite ejecutar los mismos tests con ambos roles sin duplicar lógica de login                  |
| Proyectos Playwright por rol (`chromium-admin`, `chromium-trader`) | El mismo spec file se ejecuta dos veces, cada vez con el auth correcto                          |
| `headed-debug` project con `headless: false` y `slowMo: 400`       | Permite al agente observar el browser en tiempo real y detectar bugs visuales                   |
| Page Object Model separado por dominio                             | Los locators del chat son muy distintos a los de admin; evitar acoplamiento                     |
| Polling en lugar de WebSocket para status de documentos en tests   | Playwright no tiene soporte nativo fluido para SSE assertion; polling es más determinista       |
| `test-doc.md` en el repo como fixture                              | Reproducibilidad determinista del test de RAG; el contenido del doc es conocido                 |
| Bloque 7b (control de acceso) solo con TRADER                      | Verificar que el guard de roles funciona desde la perspectiva del usuario que no debería entrar |
| Errores de consola como test failures                              | Spec 28 introduce mucho código nuevo; "cero errores de consola" es el primer gate de calidad    |
