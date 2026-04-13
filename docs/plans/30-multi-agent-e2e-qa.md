# Plan 30 — QA End-to-End del Sistema Multi-Agente (Spec 28)

**Spec:** `docs/specs/branches/30-multi-agent-e2e-qa.md` (v1.1)  
**Branch:** `feature/multi-agent-e2e-qa`  
**Depende de:** Spec 28 implementado en `feature/multi-agent-chat-rag`  
**Estimación:** 4 fases iterativas (test → error → fix → verify)

---

## Estado inicial requerido

```bash
# Verificar que la feature/multi-agent-chat-rag está disponible
git log --oneline feature/multi-agent-chat-rag | head -5

# Verificar que los 6 agentes existen en seed
grep -r "AgentDefinition\|NEXUS\|FORGE\|SIGMA\|CIPHER\|AEGIS" apps/api/prisma/seed.ts

# Verificar que pgvector está habilitado en docker-compose
grep -i "pgvector\|vector" docker-compose.yml

# Verificar que los nuevos endpoints existen
grep -r "admin/agents\|orchestrateDecision\|classifyIntent" apps/api/src --include="*.ts" -l

# Verificar que los 4 usuarios de seed existen
grep -E "(admin|trader)@crypto" apps/api/prisma/seed.ts
# Esperado:
#   admin@crypto.com        / Admin1234!   (ADMIN)
#   admin@cryptotrader.dev  / admin123     (ADMIN)
#   trader@crypto.com       / Trader1234!  (TRADER)
#   trader@cryptotrader.dev / trader123    (TRADER)
```

---

## Fase A — Infraestructura de test y fixtures

> **Objetivo:** Levantar el entorno completo de QA, crear los Page Objects, los auth states duales y el proyecto headed-debug.

### A.0 Configurar `playwright.config.ts` con proyectos duales + headed

Agregar al `playwright.config.ts` raíz:

```typescript
// Proyectos nuevos para Spec 30:
{
  name: 'setup-admin',
  testMatch: /global\.setup-admin\.ts/,
},
{
  name: 'setup-trader',
  testMatch: /global\.setup-trader\.ts/,
},
{
  name: 'chromium-admin',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'e2e/.auth/admin.json',
  },
  dependencies: ['setup-admin'],
  testMatch: /multi-agent.*\.spec\.ts/,
},
{
  name: 'chromium-trader',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'e2e/.auth/trader.json',
  },
  dependencies: ['setup-trader'],
  testMatch: /multi-agent.*\.spec\.ts/,
},
{
  // Proyecto para ver pruebas EN TIEMPO REAL en el browser
  name: 'headed-debug',
  use: {
    ...devices['Desktop Chrome'],
    headless: false,
    slowMo: 400,
    storageState: 'e2e/.auth/admin.json',  // cambiar por trader.json según necesidad
    video: 'retain-on-failure',
    screenshot: 'on',
  },
  dependencies: ['setup-admin'],
  testMatch: /multi-agent.*\.spec\.ts/,
},
```

### A.1 Verificar y preparar infra Docker

Asegurarse que `docker-compose.yml` tiene:

- `pgvector/pgvector:pg16` como imagen de postgres (no `postgres:16`)
- Servicio `redis` con puerto 6379
- Red interna compartida entre servicios

```bash
# Levantar infra
docker compose up -d postgres redis

# Verificar que pgvector está disponible
docker compose exec postgres psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;" crypto_trader
```

### A.2 Crear setup files para doble autenticación

**`e2e/global.setup-admin.ts`**

```typescript
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('admin@crypto.com');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page
    .getByRole('main')
    .getByRole('button', { name: /sign in/i })
    .click();
  await page.waitForURL('**/dashboard**', { timeout: 12_000 });
  await expect(page).toHaveURL(/dashboard/);
  await page.context().storageState({ path: authFile });
});
```

**`e2e/global.setup-trader.ts`**

```typescript
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/trader.json');

setup('authenticate as trader', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('trader@crypto.com');
  await page.locator('input[type="password"]').fill('Trader1234!');
  await page
    .getByRole('main')
    .getByRole('button', { name: /sign in/i })
    .click();
  await page.waitForURL('**/dashboard**', { timeout: 12_000 });
  await expect(page).toHaveURL(/dashboard/);
  await page.context().storageState({ path: authFile });
});
```

```bash
# Generar los auth states corriend el seed primero
pnpm db:seed
pnpm playwright test --project=setup-admin --project=setup-trader
# Verificar que se generaron:
ls e2e/.auth/
# admin.json  trader.json  user.json
```

### A.3 Crear Page Objects

```
e2e/page-objects/
  chat-page.ts
  agent-selector.ts
  tool-call-card.ts
  admin-agents-page.ts
```

**`e2e/page-objects/chat-page.ts`**

```typescript
import { Page, Locator } from '@playwright/test';

export class ChatPage {
  readonly page: Page;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly agentHeader: Locator;
  readonly messageList: Locator;
  readonly changeAgentButton: Locator;
  readonly orchestratingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatInput = page.getByRole('textbox', { name: /mensaje|message/i });
    this.sendButton = page.getByRole('button', { name: /enviar|send/i });
    this.agentHeader = page.getByTestId('agent-header');
    this.messageList = page.getByTestId('chat-messages');
    this.changeAgentButton = page.getByRole('button', {
      name: /cambiar agente|change agent/i,
    });
    this.orchestratingIndicator = page.getByTestId('orchestrating-indicator');
  }

  async goto() {
    await this.page.goto('/dashboard/chat');
  }

  async sendMessage(text: string) {
    await this.chatInput.fill(text);
    await this.sendButton.click();
  }

  async waitForStreamComplete(timeout = 20_000) {
    // Espera a que el último mensaje deje de tener el cursor de streaming
    await this.page.waitForFunction(
      () => !document.querySelector('[data-streaming="true"]'),
      { timeout },
    );
  }

  async getLastAssistantMessage(): Promise<string> {
    const messages = this.page.locator('[data-role="assistant"]');
    const last = messages.last();
    return last.innerText();
  }

  async collectConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    return errors;
  }
}
```

**`e2e/page-objects/agent-selector.ts`**

```typescript
import { Page, Locator } from '@playwright/test';

export type AgentId =
  | 'platform'
  | 'operations'
  | 'market'
  | 'blockchain'
  | 'risk';

export class AgentSelectorPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  agentCard(agentId: AgentId): Locator {
    return this.page.getByTestId(`agent-card-${agentId}`);
  }

  selectButton(agentId: AgentId): Locator {
    return this.agentCard(agentId).getByRole('button', {
      name: /hablar|talk/i,
    });
  }

  async select(agentId: AgentId) {
    await this.selectButton(agentId).click();
  }

  async selectAutoRoute() {
    await this.page
      .getByRole('button', { name: /krypto decide|auto/i })
      .click();
  }
}
```

**`e2e/page-objects/tool-call-card.ts`**

```typescript
import { Page, Locator } from '@playwright/test';

export class ToolCallCard {
  readonly page: Page;
  readonly card: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;
  readonly toolName: Locator;
  readonly paramsList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.card = page.getByTestId('tool-call-card');
    this.confirmButton = this.card.getByRole('button', {
      name: /confirmar|confirm/i,
    });
    this.cancelButton = this.card.getByRole('button', {
      name: /cancelar|cancel/i,
    });
    this.toolName = this.card.getByTestId('tool-name');
    this.paramsList = this.card.getByTestId('tool-params');
  }
}
```

**`e2e/page-objects/admin-agents-page.ts`**

```typescript
import { Page, Locator } from '@playwright/test';
import path from 'path';

export class AdminAgentsPage {
  readonly page: Page;
  readonly agentList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.agentList = page.getByTestId('agent-list');
  }

  async goto() {
    await this.page.goto('/admin/agents');
  }

  agentCard(agentId: string): Locator {
    return this.page.getByTestId(`admin-agent-${agentId}`);
  }

  async openEditor(agentId: string) {
    await this.agentCard(agentId)
      .getByRole('button', { name: /editar|edit/i })
      .click();
  }

  async uploadDocument(agentId: string, filePath: string) {
    await this.openEditor(agentId);
    await this.page
      .getByRole('tab', { name: /conocimiento|knowledge/i })
      .click();
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.page.getByRole('button', { name: /subir|upload/i }).click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  async waitForDocumentReady(docName: string, timeout = 30_000) {
    await this.page
      .getByTestId(`doc-status-${docName}`)
      .getByText(/ready/i)
      .waitFor({ timeout });
  }

  async runRagTest(agentId: string, query: string) {
    await this.openEditor(agentId);
    await this.page
      .getByRole('tab', { name: /diagnóstico|diagnostic/i })
      .click();
    await this.page
      .getByRole('textbox', { name: /test rag|pregunta/i })
      .fill(query);
    await this.page.getByRole('button', { name: /test|probar/i }).click();
  }
}
```

### A.3 Crear fixture de documento de prueba

```
e2e/fixtures/test-doc.md  (ver spec sección 6)
e2e/fixtures/test-doc.pdf  (versión PDF del mismo contenido para test PDF upload)
```

### A.4 Crear fixture de documento de prueba

```
e2e/fixtures/test-doc.md  (ver spec sección 6)
e2e/fixtures/test-doc.pdf  (versión PDF del mismo contenido para test PDF upload)
```

### A.5 Verificación Fase A

```bash
# Verificar que los auth states se generaron
pnpm playwright test --project=setup-admin --project=setup-trader
ls -la e2e/.auth/  # debe mostrar admin.json y trader.json

# Ejecutar un test sencillo en headed-debug para ver el browser en tiempo real
pnpm playwright test e2e/multi-agent-chat.spec.ts --project=headed-debug --grep "BLOQUE 1" \
  --headed --slowMo=400

# Verificar compilación de page-objects
tsc --noEmit -p tsconfig.base.json
```

---

## Fase B — Suite de tests de chat (Bloques 1–6)

> **Objetivo:** Tests del chat multi-agente: selector, routing, streaming, RAG, tool calling, cross-agent.

### B.1 Crear `e2e/multi-agent-chat.spec.ts`

Estructura:

```typescript
/**
 * Spec 30 — QA E2E del Sistema Multi-Agente (Spec 28)
 * Suite: Chat (AgentSelector, Routing, Streaming, RAG, Tools, Cross-Agent)
 */
import { test, expect, type Page } from '@playwright/test';
import { ChatPage } from './page-objects/chat-page';
import { AgentSelectorPage } from './page-objects/agent-selector';
import { ToolCallCard } from './page-objects/tool-call-card';

// ── Credenciales ──────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'admin@crypto.com';
const ADMIN_PASSWORD = 'Admin1234!';

// ── Helper: login fresco ──────────────────────────────────────────────────────
async function freshLogin(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('main').getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 12_000 });
}

// ── Monitor de consola ────────────────────────────────────────────────────────
const consoleErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[PAGE ERROR] ${err.message}`);
  });
  await freshLogin(page);
});
test.afterEach(async () => {
  expect(consoleErrors, `Errores de consola: ${consoleErrors.join('\n')}`).toHaveLength(0);
});

// ── BLOQUE 1: AgentSelector ───────────────────────────────────────────────────
test.describe('BLOQUE 1 — AgentSelector', () => {
  test('1.1 AgentSelector visible al abrir /dashboard/chat', async ({ page }) => { ... });
  test('1.2 Click NEXUS → header muestra NEXUS', async ({ page }) => { ... });
  test('1.3 Click SIGMA → header muestra SIGMA (Análisis de Mercado)', async ({ page }) => { ... });
  test('1.4 Click FORGE → header muestra FORGE', async ({ page }) => { ... });
  test('1.5 Click CIPHER → header muestra CIPHER', async ({ page }) => { ... });
  test('1.6 Click AEGIS → header muestra AEGIS', async ({ page }) => { ... });
  test('1.7 Opción "Dejar que KRYPTO decida" disponible', async ({ page }) => { ... });
});

// ── BLOQUE 2: Intent Routing ──────────────────────────────────────────────────
test.describe('BLOQUE 2 — Intent Routing de KRYPTO', () => {
  test('2.1 Mensaje sobre plataforma → routing a platform (NEXUS)', async ({ page }) => { ... });
  test('2.2 Mensaje sobre mercado → routing a market (SIGMA)', async ({ page }) => { ... });
  test('2.3 Mensaje sobre blockchain → routing a blockchain (CIPHER)', async ({ page }) => { ... });
  test('2.4 Animación de routing visible antes del stream', async ({ page }) => { ... });
  test('2.5 Después de routing → agentId correcto en DB', async ({ page }) => { ... });
});

// ── BLOQUE 3: Chat por sub-agente ─────────────────────────────────────────────
test.describe('BLOQUE 3 — Chat por sub-agente', () => {
  test('3.1 NEXUS responde sobre stop-loss de la plataforma', async ({ page }) => { ... });
  test('3.2 SIGMA responde con contexto de mercado', async ({ page }) => { ... });
  test('3.3 FORGE responde sobre estrategia BTC/USDT', async ({ page }) => { ... });
  test('3.4 CIPHER responde sobre AMM', async ({ page }) => { ... });
  test('3.5 AEGIS responde sobre exposición de portfolio', async ({ page }) => { ... });
  test('3.6 Streaming visible — tokens llegan progresivamente', async ({ page }) => { ... });
});

// ── BLOQUE 4: RAG ─────────────────────────────────────────────────────────────
test.describe('BLOQUE 4 — RAG en chat', () => {
  test('4.1 Respuesta de NEXUS incluye info del documento subido', async ({ page }) => { ... });
});

// ── BLOQUE 5: Tool Calling ────────────────────────────────────────────────────
test.describe('BLOQUE 5 — Tool Calling (FORGE)', () => {
  test('5.1 ToolCallCard visible al pedir crear config', async ({ page }) => { ... });
  test('5.2 Confirmar → config creada en /dashboard/config', async ({ page }) => { ... });
  test('5.3 Cancelar → NO crea config', async ({ page }) => { ... });
});

// ── BLOQUE 6: Cross-agent ─────────────────────────────────────────────────────
test.describe('BLOQUE 6 — Cross-agent synthesis', () => {
  test('6.1 Consulta mix ETH+AMM → OrchestratingIndicator visible', async ({ page }) => { ... });
  test('6.2 Respuesta menciona perspectivas de mercado Y blockchain', async ({ page }) => { ... });
});
```

### B.2 Implementar cada test con locators reales

Cada `test(...)` con cuerpo vacío `{ ... }` en el esquema de B.1 debe implementarse con locators reales basados en los `data-testid` que deben estar presentes en el frontend.

**Convención de data-testid requeridos en el frontend (Spec 28):**

| Componente             | data-testid esperado                           |
| ---------------------- | ---------------------------------------------- |
| AgentSelector          | `agent-selector`, `agent-card-{agentId}`       |
| AgentHeader            | `agent-header`, texto con nombre del agente    |
| OrchestratingIndicator | `orchestrating-indicator`                      |
| ToolCallCard           | `tool-call-card`, `tool-name`, `tool-params`   |
| Chat input             | `chat-input` o `role="textbox"`                |
| Mensaje de asistente   | `data-role="assistant"`                        |
| Streaming indicator    | `data-streaming="true"` mientras llegan tokens |

> **IMPORTANTE:** Si los `data-testid` no existen en los componentes de Spec 28, agregar como parte de los fixes de esta fase.

### B.3 Correr Bloque 1 y 2 primero

```bash
# Servir backend
pnpm nx serve api &

# Servir frontend
pnpm nx serve web &

# Correr solo bloques 1 y 2
pnpm playwright test e2e/multi-agent-chat.spec.ts --grep "BLOQUE [12]" --headed
```

### B.4 Aplicar fixes de Bloque 1–2

Por cada test que falla, analizar:

1. ¿El componente no tiene el `data-testid`? → Agregar al componente React
2. ¿La ruta no existe? → Verificar routing en `app-routes.tsx`
3. ¿Error de consola? → Fix en el código, luego re-test
4. ¿SSE event `routing` no llega? → Fix en `ChatService` o `ChatGateway`

Commit por cada fix: `fix(chat): add data-testid to AgentSelector — Spec 30`

### B.5 Correr Bloques 3–6 tras fixes

```bash
pnpm playwright test e2e/multi-agent-chat.spec.ts --grep "BLOQUE [3456]" --headed
```

### B.6 Tests Fase B

```bash
pnpm nx test api --testPathPattern="chat|orchestrator"  # tests unitarios del back
pnpm playwright test e2e/multi-agent-chat.spec.ts       # e2e completo
```

### B.7 Verificación

```bash
pnpm nx build api
pnpm nx build web
pnpm playwright test e2e/multi-agent-chat.spec.ts --reporter=list
# Todos los tests en verde
```

---

## Fase C — Suite de tests de Admin (Bloque 7)

> **Objetivo:** Tests del panel de Admin para gestión de agentes, documentos y RAG.

### C.1 Crear `e2e/multi-agent-admin.spec.ts`

```typescript
/**
 * Spec 30 — QA E2E del Sistema Multi-Agente (Spec 28)
 * Suite: Admin Panel — Agentes, Documentos, RAG
 */
import { test, expect, type Page } from '@playwright/test';
import { AdminAgentsPage } from './page-objects/admin-agents-page';
import path from 'path';

const TEST_DOC = path.join(__dirname, 'fixtures/test-doc.md');

test.describe('BLOQUE 7 — Admin: gestión de agentes', () => {
  test('7.1 /admin/agents carga con 6 tarjetas', async ({ page }) => { ... });
  test('7.2 Toggle activo/inactivo persiste via PATCH', async ({ page }) => { ... });
  test('7.3 Editor de SIGMA tiene 3 tabs', async ({ page }) => { ... });
  test('7.4 Editar system prompt de SIGMA → guardar → reload → mismo texto', async ({ page }) => { ... });
  test('7.5 Subir test-doc.md → status PENDING → READY', async ({ page }) => { ... });
  test('7.6 Eliminar documento → no aparece en lista', async ({ page }) => { ... });
  test('7.7 Test RAG → devuelve chunks con score', async ({ page }) => { ... });
});
```

### C.2 Verificar endpoints de admin con API testing

Antes de la UI, verificar los endpoints REST directamente:

```typescript
// En multi-agent-admin.spec.ts también:
test.describe('API: Admin Agents Endpoints', () => {
  test('GET /admin/agents devuelve 6 agentes', async ({ request }) => {
    const res = await request.get('/api/admin/agents', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(6);
  });

  test('POST /admin/agents/market/documents acepta texto MD', async ({ request }) => { ... });
  test('POST /admin/agents/market/rag-test devuelve chunks', async ({ request }) => { ... });
});
```

### C.3 Ejecutar y aplicar fixes

```bash
pnpm playwright test e2e/multi-agent-admin.spec.ts --headed

# Fixes típicos esperados:
# - Rutas admin no registradas en el router frontend
# - Componente AdminAgentsPage no tiene data-testid
# - Endpoint admin no retorna el formato esperado
# - Upload de archivos falla porque el controlador no tiene FilesInterceptor configurado
```

### C.4 Verificación Fase C

```bash
pnpm playwright test e2e/multi-agent-admin.spec.ts --reporter=list
# Verde
```

---

## Fase D — Suite de trading orquestado (Bloque 8) + Smoke global (Bloque 9)

> **Objetivo:** Verificar badge de decisión orquestada para ambos roles + smoke test sin errores de consola.

### D.1 Crear `e2e/multi-agent-trading.spec.ts`

```typescript
/**
 * Spec 30 — QA E2E del Sistema Multi-Agente (Spec 28)
 * Suite: Trading Orquestado + Smoke Test
 * Proyectos: chromium-admin + chromium-trader
 */

// ── BLOQUE 8: BotAnalysis (ADMIN + TRADER) ────────────────────────────────────
test.describe('BLOQUE 8 — BotAnalysis: decisión orquestada [ADMIN + TRADER]', () => {
  test('8.1 Badge "Decisión orquestada" visible si hay decisiones', async ({
    page,
  }) => {
    await page.goto('/dashboard/bot-analysis');
    const badge = page.getByTestId('orchestrated-decision-badge');
    const hasBadge = await badge.isVisible().catch(() => false);
    if (hasBadge) {
      await expect(badge).toBeVisible();
      await expect(page.getByTestId('sub-agents-consulted')).toBeVisible();
    }
  });
  test('8.2 TRADER solo ve sus propias decisiones (no de otros usuarios)', async ({
    page,
  }) => {
    const role = await getRole(page);
    test.skip(role !== 'TRADER', 'Verificar aislamiento de TRADER');
    await page.goto('/dashboard/bot-analysis');
    // Verificar que no hay decisiones de otros usuarios (seguridad)
  });
});

// ── BLOQUE 9: Smoke test (ADMIN + TRADER) ──────────────────────────────────────
test.describe('BLOQUE 9 — Smoke test sin errores de consola', () => {
  const adminRoutes = [
    '/dashboard/chat',
    '/dashboard/bot-analysis',
    '/admin/agents',
  ];
  const traderRoutes = ['/dashboard/chat', '/dashboard/bot-analysis'];

  test('9.1-9.3 Admin navega rutas nuevas sin errores JS', async ({ page }) => {
    const role = await getRole(page);
    const routes = role === 'ADMIN' ? adminRoutes : traderRoutes;
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }
    expect(errors).toHaveLength(0);
  });
  test('9.6 TRADER intenta /admin/agents → redirect sin errores JS', async ({
    page,
  }) => {
    const role = await getRole(page);
    test.skip(role !== 'TRADER', 'Solo TRADER');
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/admin/agents');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/dashboard/);
    expect(errors).toHaveLength(0);
  });
});
```

### D.2 Comandos finales de ejecución

```bash
# TIEMPO REAL — Smoke test con ADMIN en browser visible:
pnpm playwright test e2e/multi-agent-trading.spec.ts \
  --project=headed-debug \
  --headed --slowMo=400

# Suite completa multi-agente — ambos roles, todos los bloques:
pnpm playwright test \
  --grep "BLOQUE" \
  --project=chromium-admin \
  --project=chromium-trader \
  --reporter=html

# Ver reporte HTML
pnpm playwright show-report
```

### D.4 Verificación final completa

```bash
# Infra limpia
docker compose down -v
docker compose up -d postgres redis
pnpm nx run api:db-migrate
pnpm db:seed

# Auth states
pnpm playwright test --project=setup-admin --project=setup-trader

# Builds
pnpm nx build api && pnpm nx build web

# Tests unitarios
pnpm nx test api && pnpm nx test web

# E2E completo — ambos roles
pnpm playwright test \
  --project=chromium-admin \
  --project=chromium-trader

# Reporte
pnpm playwright show-report
```

---

## Criterios de aceptación

- [ ] Auth states generados correctamente: `e2e/.auth/admin.json` y `e2e/.auth/trader.json`
- [ ] Proyecto `headed-debug` configurado en `playwright.config.ts` (headless: false, slowMo: 400)
- [ ] `e2e/multi-agent-chat.spec.ts` — todos los tests en verde para **ADMIN y TRADER** (bloques 1–6)
- [ ] `e2e/multi-agent-admin.spec.ts` — todos los tests en verde: ADMIN gestionó agentes, TRADER recibió 403
- [ ] `e2e/multi-agent-trading.spec.ts` — todos los tests en verde para ambos roles (bloques 8–9)
- [ ] Cero errores de consola JavaScript para ambos usuarios en todos los bloques
- [ ] Fixture `test-doc.md` subido y procesado (RAG READY) — verificado que Trader también se beneficia
- [ ] Todos los `data-testid` faltantes añadidos a los componentes de Spec 28
- [ ] `pnpm nx build api && pnpm nx build web` — sin errores TS
- [ ] `pnpm nx test api` — sin tests fallando

---

## Cierre de branch

````bash
git push origin feature/multi-agent-e2e-qa

cat > /tmp/pr-body-30.md << 'PREOF'
## Spec 30 — QA E2E del Sistema Multi-Agente (Spec 28)

### Objetivos completados
- Suite E2E completa de Playwright para los 9 bloques de Spec 28
- Page Objects: ChatPage, AgentSelectorPage, ToolCallCard, AdminAgentsPage
- Fixture test-doc.md para tests deterministas de RAG
- Fixes aplicados al backend y frontend durante el ciclo QA

### Tests implementados
| Suite | Bloques | Tests |
|-------|---------|-------|
| multi-agent-chat.spec.ts | 1–6 | AgentSelector, Routing, Chat, RAG, Tools, Cross-agent |
| multi-agent-admin.spec.ts | 7 | Admin: agentes, docs, RAG test |
| multi-agent-trading.spec.ts | 8–9 | BotAnalysis + Smoke global |

### Verificación
```bash
pnpm nx build api   # ✅
pnpm nx build web   # ✅
pnpm nx test api    # ✅
pnpm playwright test # ✅ todos los bloques en verde
````

PREOF

gh auth switch --user e-burgos
gh pr create \
 --title "test: E2E QA suite for multi-agent system (admin+trader) + fixes [Spec 30]" \
 --base feature/multi-agent-chat-rag \
 --head feature/multi-agent-e2e-qa \
 --body-file /tmp/pr-body-30.md

```

**Nota:** El PR base es `feature/multi-agent-chat-rag` (no `main`) ya que Spec 30 depende de Spec 28 que todavía no está mergeada.

**Siguiente branch:** `feature/adaptive-agents` (Spec 29) — después de mergear Spec 28 + Spec 30
```
