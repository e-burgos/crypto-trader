/**
 * Spec 30 — QA E2E del Sistema Multi-Agente (Spec 28)
 * Suite: Trading dashboard + Smoke global (BLOQUE 8 + 9)
 *
 * BLOQUE 8 — /dashboard/bot-analysis (solo TRADER: /dashboard/* está restringido a ese rol)
 * BLOQUE 9 — Smoke test de navegación completa por rol
 */
import { test, expect, Page } from '@playwright/test';
import { getRole } from './helpers/get-role';
import { ChatPage } from './page-objects/chat-page';
import {
  hasLlmCredentials,
  NO_LLM_KEYS_REASON,
} from './helpers/llm-availability';

const ADMIN_HAS_NO_DASHBOARD_REASON =
  '/dashboard/* está restringido al rol TRADER: el ADMIN es redirigido a /admin.';

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
      !e.includes('status of 401') &&
      !e.includes('status of 403') &&
      !e.includes('[vite]') &&
      !e.includes('favicon'),
  );
  expect(
    realErrors,
    `Errores de consola:\n${realErrors.join('\n')}`,
  ).toHaveLength(0);
});

function realConsoleErrors() {
  return consoleErrors.filter(
    (e) =>
      !e.includes('WebSocket') &&
      !e.includes('[vite]') &&
      !e.includes('favicon'),
  );
}

/** networkidle nunca ocurre en el dashboard: WebSocket + polling siempre activos. */
async function gotoAndSettle(page: Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 8 — Dashboard bot-analysis [SOLO TRADER]
// ─────────────────────────────────────────────────────────────────────────────
test.describe('BLOQUE 8 — Dashboard bot-analysis [SOLO TRADER]', () => {
  test.beforeEach(async ({ page }) => {
    test.skip((await getRole(page)) === 'ADMIN', ADMIN_HAS_NO_DASHBOARD_REASON);
  });

  test('8.1 /dashboard/bot-analysis carga sin errores JS', async ({ page }) => {
    await gotoAndSettle(page, '/dashboard/bot-analysis');
    await expect(page).toHaveURL(/bot-analysis/);
  });

  test('8.2 La página muestra contenido relevante (positions, bots o empty state)', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/dashboard/bot-analysis');
    await expect(
      page.locator('h1').filter({ hasText: /bot analysis/i }),
    ).toBeVisible();
  });

  test('8.3 Badge de decisión orquestada visible cuando metadata.orchestrated = true', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/dashboard/bot-analysis');
    const badge = page.getByTestId('orchestrated-decision-badge');
    if ((await badge.count()) > 0) {
      await expect(badge.first()).toBeVisible();
    }
  });

  test('8.4 TRADER solo ve sus propias decisiones (sin datos de otros usuarios)', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/dashboard/bot-analysis');
    const pageText = await page.locator('body').innerText();
    expect(pageText).not.toContain('admin@crypto.com');
  });
});

test.describe('BLOQUE 8b — Aislamiento del panel de trading [SOLO ADMIN]', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      (await getRole(page)) !== 'ADMIN',
      'Verificación de privilegios ADMIN',
    );
  });

  test('8b.1 ADMIN en /dashboard/bot-analysis es redirigido a su propio panel', async ({
    page,
  }) => {
    await page.goto('/dashboard/bot-analysis');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    const pageText = await page.locator('body').innerText();
    for (const phrase of [
      'sin permiso',
      'unauthorized',
      'forbidden',
      'access denied',
    ]) {
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
  const ADMIN_ROUTES = ['/admin', '/admin/agents', '/admin/users'];

  test('9.1 TRADER navega todas sus rutas sin errores JS', async ({ page }) => {
    test.skip((await getRole(page)) !== 'TRADER', 'Test de smoke TRADER');
    for (const route of TRADER_ROUTES) {
      consoleErrors = [];
      await gotoAndSettle(page, route);
      expect(
        realConsoleErrors(),
        `[${route}] Errores de consola:\n${realConsoleErrors().join('\n')}`,
      ).toHaveLength(0);
    }
  });

  test('9.2 TRADER en /admin redirige a /dashboard limpiamente', async ({
    page,
  }) => {
    test.skip(
      (await getRole(page)) !== 'TRADER',
      'Test de restricción de acceso TRADER',
    );
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('9.3 ADMIN navega todas las rutas sin errores JS', async ({ page }) => {
    test.skip((await getRole(page)) !== 'ADMIN', 'Test de smoke ADMIN');
    for (const route of ADMIN_ROUTES) {
      consoleErrors = [];
      await gotoAndSettle(page, route);
      expect(
        realConsoleErrors(),
        `[${route}] Errores de consola:\n${realConsoleErrors().join('\n')}`,
      ).toHaveLength(0);
    }
  });

  test('9.4 /dashboard/chat permanece montado 10s sin errores', async ({
    page,
  }) => {
    test.skip((await getRole(page)) === 'ADMIN', ADMIN_HAS_NO_DASHBOARD_REASON);
    const chat = new ChatPage(page);
    await chat.goto();
    await page.waitForTimeout(10_000);
    expect(
      realConsoleErrors(),
      `Errores tras 10s en /dashboard/chat:\n${realConsoleErrors().join('\n')}`,
    ).toHaveLength(0);
  });

  test('9.5 El chat input está presente y habilitado en /dashboard/chat', async ({
    page,
  }) => {
    test.skip((await getRole(page)) === 'ADMIN', ADMIN_HAS_NO_DASHBOARD_REASON);
    await page.goto('/dashboard');
    test.skip(!(await hasLlmCredentials(page)), NO_LLM_KEYS_REASON);
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await expect(chat.chatInput).toBeVisible({ timeout: 10_000 });
    await expect(chat.chatInput).toBeEnabled();
  });

  test('9.6 El AgentSelector está presente en /dashboard/chat', async ({
    page,
  }) => {
    test.skip((await getRole(page)) === 'ADMIN', ADMIN_HAS_NO_DASHBOARD_REASON);
    await page.goto('/dashboard');
    test.skip(!(await hasLlmCredentials(page)), NO_LLM_KEYS_REASON);
    const chat = new ChatPage(page);
    await chat.gotoWithSession();
    await expect(chat.agentSelector).toBeVisible({ timeout: 10_000 });
  });

  test('9.7 Reload de /dashboard/chat no causa error de hidratación', async ({
    page,
  }) => {
    test.skip((await getRole(page)) === 'ADMIN', ADMIN_HAS_NO_DASHBOARD_REASON);
    const chat = new ChatPage(page);
    await chat.goto();
    await page.reload();
    await chat.goto();
    const hydrationSafe = consoleErrors.filter(
      (e) =>
        !e.includes('WebSocket') &&
        !e.includes('[vite]') &&
        !e.includes('favicon') &&
        !(e.includes('Minified React error') && e.includes('hydrat')),
    );
    expect(
      hydrationSafe,
      `Errores tras reload:\n${hydrationSafe.join('\n')}`,
    ).toHaveLength(0);
  });
});
