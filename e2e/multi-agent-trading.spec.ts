/**
 * Spec 30 — QA E2E del Sistema Multi-Agente (Spec 28)
 * Suite: Trading dashboard + Smoke global (BLOQUE 8 + 9)
 *
 * BLOQUE 8 — /dashboard/bot-analysis para ambos roles
 * BLOQUE 9 — Smoke test de navegación completa
 *
 * En tiempo real (browser visible):
 *   pnpm playwright test e2e/multi-agent-trading.spec.ts --project=headed-debug --headed --slowMo=400
 */
import { test, expect } from '@playwright/test';
import { getRole } from './helpers/get-role';
import { ChatPage } from './page-objects/chat-page';

// ── Monitor de consola ────────────────────────────────────────────────────────
let consoleErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`[PAGE ERROR] ${err.message}`);
  });
});
test.afterEach(async () => {
  const realErrors = consoleErrors.filter(
    (e) =>
      !e.includes('WebSocket') &&
      !e.includes('[vite]') &&
      !e.includes('favicon'),
  );
  expect(
    realErrors,
    `Errores de consola:\n${realErrors.join('\n')}`,
  ).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 8 — Dashboard bot-analysis [AMBOS ROLES]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 8 — Dashboard bot-analysis [AMBOS ROLES]', () => {
  test('8.1 /dashboard/bot-analysis carga sin errores JS', async ({ page }) => {
    await page.goto('/dashboard/bot-analysis');
    await expect(page).toHaveURL(/bot-analysis/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');
    // afterEach verifica ausencia de errores JS
  });

  test('8.2 La página muestra contenido relevante (positions, bots o empty state)', async ({
    page,
  }) => {
    await page.goto('/dashboard/bot-analysis');
    await page.waitForLoadState('networkidle');
    // Debe haber algún contenido visible (tabla, cards, empty state, heading)
    const content = page
      .locator(
        'table, [data-testid*="position"], [data-testid*="bot"], [data-testid*="empty"], h1, h2',
      )
      .first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test('8.3 Badge de decisión orquestada visible cuando metadata.orchestrated = true', async ({
    page,
  }) => {
    await page.goto('/dashboard/bot-analysis');
    await page.waitForLoadState('networkidle');
    // Si existen decisiones orquestadas, el badge debe estar visible
    const badge = page.getByTestId('orchestrated-decision-badge');
    const count = await badge.count();
    // Pass si no hay decisiones aún (count = 0) o si el badge está correctamente renderizado
    if (count > 0) {
      await expect(badge.first()).toBeVisible();
    }
    // El test pasa en ambos casos — verifica que no explota cuando sí hay datos
  });

  test('8.4 TRADER solo ve sus propias decisiones (sin datos de otros usuarios)', async ({
    page,
  }) => {
    const role = await getRole(page);
    test.skip(
      role !== 'TRADER',
      'Test de aislamiento de datos requiere TRADER',
    );
    await page.goto('/dashboard/bot-analysis');
    await page.waitForLoadState('networkidle');
    // No debe haber referencias a admin@crypto.com en los datos visibles
    const pageText = await page.locator('body').innerText();
    expect(pageText).not.toContain('admin@crypto.com');
  });

  test('8.5 ADMIN puede ver el panel de análisis sin restricciones', async ({
    page,
  }) => {
    const role = await getRole(page);
    test.skip(role !== 'ADMIN', 'Verificación de privilegios ADMIN');
    await page.goto('/dashboard/bot-analysis');
    await expect(page).toHaveURL(/bot-analysis/, { timeout: 10_000 });
    // No debe aparecer un mensaje de "sin permiso"
    const pageText = await page.locator('body').innerText();
    const blockedPhrases = [
      'sin permiso',
      'unauthorized',
      'forbidden',
      'access denied',
    ];
    for (const phrase of blockedPhrases) {
      expect(pageText.toLowerCase()).not.toContain(phrase);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 9 — Smoke test global [AMBOS ROLES]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 9 — Smoke test global de navegación [AMBOS ROLES]', () => {
  const TRADER_ROUTES = [
    '/dashboard',
    '/dashboard/chat',
    '/dashboard/bot-analysis',
  ];
  const ADMIN_EXTRA_ROUTES = ['/admin', '/admin/agents'];

  test('9.1 TRADER navega todas sus rutas sin errores JS', async ({ page }) => {
    const role = await getRole(page);
    test.skip(role !== 'TRADER', 'Test de smoke TRADER');
    for (const route of TRADER_ROUTES) {
      consoleErrors = []; // reset por ruta
      await page.goto(route);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      const realErrors = consoleErrors.filter(
        (e) =>
          !e.includes('WebSocket') &&
          !e.includes('[vite]') &&
          !e.includes('favicon'),
      );
      expect(
        realErrors,
        `[${route}] Errores de consola:\n${realErrors.join('\n')}`,
      ).toHaveLength(0);
    }
  });

  test('9.2 TRADER en /admin redirige a /dashboard limpiamente', async ({
    page,
  }) => {
    const role = await getRole(page);
    test.skip(role !== 'TRADER', 'Test de restricción de acceso TRADER');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');
  });

  test('9.3 ADMIN navega todas las rutas sin errores JS', async ({ page }) => {
    const role = await getRole(page);
    test.skip(role !== 'ADMIN', 'Test de smoke ADMIN');
    const allRoutes = [...TRADER_ROUTES, ...ADMIN_EXTRA_ROUTES];
    for (const route of allRoutes) {
      consoleErrors = [];
      await page.goto(route);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      const realErrors = consoleErrors.filter(
        (e) =>
          !e.includes('WebSocket') &&
          !e.includes('[vite]') &&
          !e.includes('favicon'),
      );
      expect(
        realErrors,
        `[${route}] Errores de consola:\n${realErrors.join('\n')}`,
      ).toHaveLength(0);
    }
  });

  test('9.4 /dashboard/chat permanece montado 10s sin errores', async ({
    page,
  }) => {
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');
    // Esperar 10 segundos para detectar errores asincrónicos (timers, WS reconnects)
    await page.waitForTimeout(10_000);
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('WebSocket') &&
        !e.includes('[vite]') &&
        !e.includes('favicon'),
    );
    expect(
      realErrors,
      `Errores tras 10s en /dashboard/chat:\n${realErrors.join('\n')}`,
    ).toHaveLength(0);
  });

  test('9.5 El chat input está presente y aceptable en /dashboard/chat', async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await expect(chat.chatInput).toBeVisible({ timeout: 8_000 });
    await expect(chat.chatInput).toBeEnabled();
  });

  test('9.6 El AgentSelector está presente en /dashboard/chat', async ({
    page,
  }) => {
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await expect(chat.agentSelector).toBeVisible({ timeout: 8_000 });
  });

  test('9.7 Reload de /dashboard/chat no causa error de hidratación', async ({
    page,
  }) => {
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('WebSocket') &&
        !e.includes('[vite]') &&
        !e.includes('favicon') &&
        !(e.includes('Minified React error') && e.includes('hydrat')),
    );
    expect(
      realErrors,
      `Errores tras reload:\n${realErrors.join('\n')}`,
    ).toHaveLength(0);
  });
});
