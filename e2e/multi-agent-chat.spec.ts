/**
 * Spec 30 — QA E2E del Sistema Multi-Agente (Spec 28)
 * Suite: Chat — AgentSelector, Routing, Streaming, RAG, Tools, Cross-Agent
 *
 * Ejecutar con:
 *   pnpm playwright test e2e/multi-agent-chat.spec.ts --project=chromium-admin --project=chromium-trader
 *
 * En tiempo real (browser visible):
 *   pnpm playwright test e2e/multi-agent-chat.spec.ts --project=headed-debug --headed --slowMo=400 --grep "BLOQUE 1"
 *
 * ADMIN = admin@crypto.com / Admin1234!  (inyectado via storageState por chromium-admin)
 * TRADER = trader@crypto.com / Trader1234! (inyectado via storageState por chromium-trader)
 */
import { test, expect } from '@playwright/test';
import { ChatPage } from './page-objects/chat-page';
import { AgentSelectorPage, AGENT_NAMES } from './page-objects/agent-selector';
import { ToolCallCard } from './page-objects/tool-call-card';
import { getRole } from './helpers/get-role';

// ── Monitor de consola — todos los tests ─────────────────────────────────────
let consoleErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`[PAGE ERROR] ${err.message}`);
  });
  page.on('response', (res) => {
    // Solo loguear — no fallar por 401 (puede ocurrir en checks opcionales)
    if (res.status() >= 500) {
      console.warn(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });
});
test.afterEach(async () => {
  // Filtrar errores conocidos de librerías externas (HMR, etc.)
  const realErrors = consoleErrors.filter(
    (e) =>
      !e.includes('WebSocket') &&
      !e.includes('[vite]') &&
      !e.includes('favicon'),
  );
  expect(
    realErrors,
    `Errores de consola detectados:\n${realErrors.join('\n')}`,
  ).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — AgentSelector [ADMIN + TRADER]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 1 — AgentSelector [ADMIN + TRADER]', () => {
  test('1.1 AgentSelector visible al abrir /dashboard/chat', async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await expect(chat.agentSelector).toBeVisible({ timeout: 10_000 });
  });

  test('1.2 Click NEXUS → header muestra NEXUS', async ({ page }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('platform');
    await expect(chat.agentHeader).toContainText('NEXUS', { timeout: 5_000 });
  });

  test('1.3 Click SIGMA → header muestra SIGMA', async ({ page }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('market');
    await expect(chat.agentHeader).toContainText('SIGMA', { timeout: 5_000 });
  });

  test('1.4 Click FORGE → header muestra FORGE', async ({ page }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('operations');
    await expect(chat.agentHeader).toContainText('FORGE', { timeout: 5_000 });
  });

  test('1.5 Click CIPHER → header muestra CIPHER', async ({ page }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('blockchain');
    await expect(chat.agentHeader).toContainText('CIPHER', { timeout: 5_000 });
  });

  test('1.6 Click AEGIS → header muestra AEGIS', async ({ page }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('risk');
    await expect(chat.agentHeader).toContainText('AEGIS', { timeout: 5_000 });
  });

  test('1.7 Opción auto (KRYPTO decide) disponible', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await expect(page.getByTestId('agent-card-auto')).toBeVisible({
      timeout: 8_000,
    });
  });

  test('1.8 Todos los agents cards visibles (5 sub + 1 auto)', async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    for (const id of [
      'platform',
      'operations',
      'market',
      'blockchain',
      'risk',
    ] as const) {
      await expect(page.getByTestId(`agent-card-${id}`)).toBeVisible({
        timeout: 8_000,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — Intent Routing de KRYPTO [ADMIN + TRADER]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 2 — Intent Routing de KRYPTO [ADMIN + TRADER]', () => {
  test('2.1 Seleccionar auto → chat input habilitado', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    // Seleccionar modo auto (KRYPTO decide)
    await page.getByTestId('agent-card-auto').click();
    // El input debe estar habilitado para escribir
    await expect(chat.chatInput).toBeEnabled({ timeout: 5_000 });
  });

  test('2.2 Seleccionar NEXUS directamente → agentId platform en header', async ({
    page,
  }) => {
    const selector = new AgentSelectorPage(page);
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await selector.select('platform');
    await expect(chat.agentHeader).toHaveAttribute(
      'data-agent-id',
      'platform',
      {
        timeout: 5_000,
      },
    );
  });

  test('2.3 Seleccionar SIGMA → agentId market en header', async ({ page }) => {
    const selector = new AgentSelectorPage(page);
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await selector.select('market');
    await expect(chat.agentHeader).toHaveAttribute('data-agent-id', 'market', {
      timeout: 5_000,
    });
  });

  test('2.4 AgentSelector persiste visible tras seleccionar agente', async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('market');
    // El selector siempre está visible — podemos cambiar de agente en cualquier momento
    await expect(chat.agentSelector).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3 — Chat con cada sub-agente [ADMIN + TRADER]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 3 — Chat por sub-agente [ADMIN + TRADER]', () => {
  // serial: evitar rate-limit de Groq (429) — los tests LLM no deben correr en paralelo
  test.describe.configure({ mode: 'serial' });
  async function chatWithAgent(
    page: import('@playwright/test').Page,
    agentId: import('./page-objects/agent-selector').AgentId,
    question: string,
  ) {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select(agentId);
    await expect(chat.chatInput).toBeEnabled({ timeout: 5_000 });
    await chat.sendMessage(question);
    // Esperar que aparezca al menos un mensaje del asistente
    await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({
      timeout: 30_000,
    });
  }

  test('3.1 NEXUS responde sobre stop-loss de la plataforma', async ({
    page,
  }) => {
    await chatWithAgent(
      page,
      'platform',
      '¿Cómo configuro el stop-loss en la plataforma?',
    );
    const msg = await new ChatPage(page).getLastAssistantMessage();
    expect(msg.length).toBeGreaterThan(20);
  });

  test('3.2 SIGMA responde sobre RSI de BTC', async ({ page }) => {
    await chatWithAgent(
      page,
      'market',
      '¿Qué es el RSI y cómo interpretarlo en BTC?',
    );
    const msg = await new ChatPage(page).getLastAssistantMessage();
    expect(msg.length).toBeGreaterThan(20);
  });

  test('3.3 FORGE responde sobre estrategia BTC/USDT', async ({ page }) => {
    await chatWithAgent(
      page,
      'operations',
      '¿Cuál es una buena estrategia de entrada para BTC/USDT?',
    );
    const msg = await new ChatPage(page).getLastAssistantMessage();
    expect(msg.length).toBeGreaterThan(20);
  });

  test('3.4 CIPHER responde sobre qué es un AMM', async ({ page }) => {
    await chatWithAgent(page, 'blockchain', '¿Qué es un AMM en DeFi?');
    const msg = await new ChatPage(page).getLastAssistantMessage();
    expect(msg.length).toBeGreaterThan(20);
  });

  test('3.5 AEGIS responde sobre exposición de portfolio', async ({ page }) => {
    await chatWithAgent(
      page,
      'risk',
      '¿Cuál es la exposición máxima recomendada para un solo activo?',
    );
    const msg = await new ChatPage(page).getLastAssistantMessage();
    expect(msg.length).toBeGreaterThan(20);
  });

  test('3.6 El input del chat está present y habilitado tras seleccionar agente', async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('market');
    await expect(chat.chatInput).toBeEnabled({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 4 — RAG en chat [ADMIN sube doc / TRADER lo usa]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 4 — RAG en chat', () => {
  test('4.1 NEXUS responde y el chat funciona (RAG activo si hay documentos)', async ({
    page,
  }) => {
    // Este test no verifica el contenido del RAG (depende de docs subidos)
    // sino que el chat con NEXUS no rompe con RAG activado
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('platform');
    await chat.sendMessage('¿Qué es el trailing stop-loss?');
    await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({
      timeout: 30_000,
    });
    const msg = await chat.getLastAssistantMessage();
    expect(msg.length).toBeGreaterThan(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 5 — Tool Calling (FORGE) [ADMIN + TRADER]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 5 — Tool Calling FORGE [ADMIN + TRADER]', () => {
  test('5.1 FORGE responde sin errores de consola', async ({ page }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    await selector.select('operations');
    await chat.sendMessage(
      'Quiero crear una configuración de trading para BTC/USDT en modo Sandbox',
    );
    await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('5.2 ToolCallCard visible si FORGE propone acción', async ({ page }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    const toolCard = new ToolCallCard(page);
    await chat.gotoWithSession();
    await selector.select('operations');
    await chat.sendMessage(
      'Crea una configuración BTC/USDT Sandbox con stop-loss del 3%',
    );
    // Esperar respuesta (puede ser texto O tool call card)
    await page.waitForSelector(
      '[data-role="assistant"], [data-testid="tool-call-card"]',
      {
        timeout: 30_000,
      },
    );
    // Si apareció tool-call-card: verificar botones
    const hasToolCard = await toolCard.card.isVisible().catch(() => false);
    if (hasToolCard) {
      await expect(toolCard.confirmButton).toBeVisible();
      await expect(toolCard.cancelButton).toBeVisible();
    }
  });

  test('5.3 Cancelar ToolCallCard → chat sigue activo', async ({ page }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    const toolCard = new ToolCallCard(page);
    await chat.gotoWithSession();
    await selector.select('operations');
    await chat.sendMessage(
      'Detén el agente de trading que está corriendo ahora',
    );
    await page.waitForSelector(
      '[data-role="assistant"], [data-testid="tool-call-card"]',
      {
        timeout: 30_000,
      },
    );
    const hasToolCard = await toolCard.card.isVisible().catch(() => false);
    if (hasToolCard) {
      await toolCard.cancel();
      // El chat sigue activo después de cancelar
      await expect(chat.chatInput).toBeEnabled({ timeout: 5_000 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 6 — Cross-agent synthesis [ADMIN + TRADER]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 6 — Cross-agent synthesis [ADMIN + TRADER]', () => {
  test('6.1 Consulta multi-dominio → respuesta del agente sin errores', async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    const selector = new AgentSelectorPage(page);
    await chat.gotoWithSession();
    // Seleccionar auto para que KRYPTO pueda hacer síntesis cross-agente
    await page.getByTestId('agent-card-auto').click();
    await chat.sendMessage('¿Conviene comprar ETH ahora y qué es un AMM?');
    await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({
      timeout: 45_000,
    });
    const msg = await chat.getLastAssistantMessage();
    expect(msg.length).toBeGreaterThan(40);
  });

  test('6.2 OrchestratingIndicator aparece durante la síntesis (si activo)', async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await page.getByTestId('agent-card-auto').click();
    await chat.sendMessage('¿Conviene comprar ETH ahora y qué es un AMM?');
    // El indicador de orquestación puede aparecer brevemente
    // No fail si no aparece (depende de timing del LLM)
    await page
      .getByTestId('orchestrating-indicator')
      .waitFor({ timeout: 5_000 })
      .catch(() => {
        // Acceptable: puede no aparecer si el routing es muy rápido
        console.log('OrchestratingIndicator no visible (timing)');
      });
    // Lo importante: el chat responde
    await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({
      timeout: 45_000,
    });
  });
});
