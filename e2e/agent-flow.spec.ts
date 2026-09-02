/**
 * Spec 19 — Flujo completo del agente de trading
 *
 * Cubre: login → crear agente → arrancar → agent log → posiciones → cerrar posición → detener
 *
 * Se ejecuta con el usuario TRADER: /dashboard/* está restringido a ese rol.
 * Salvo el bloque de autenticación, la sesión sale del storage state de
 * global.setup-trader — loguearse en cada test agota el rate limit de la API
 * (10 logins / 60 s por IP).
 *
 * El modo de operación global es SANDBOX, así que arrancar un agente nunca
 * dispara órdenes reales.
 */
import { test, expect, type Page } from '@playwright/test';

// Los bloques comparten el mismo agente (arrancar / detener): deben correr en orden
test.describe.configure({ mode: 'serial' });

const TRADER_EMAIL = 'trader@crypto.com';
const TRADER_PASSWORD = 'Trader1234!';
const TRADER_STATE = 'e2e/.auth/trader.json';

const AGENT_LOG_SKELETON = '.animate-pulse.rounded-xl.bg-muted';
const POSITIONS_SKELETON = '.animate-pulse.rounded-lg.bg-muted';

/** Row of the agents list on /dashboard/config for the seeded BTC/USDT config. */
function agentRow(page: Page) {
  return page
    .locator('div.flex.items-center.gap-4')
    .filter({ hasText: /BTC\/USDT/ })
    .first();
}

async function gotoAgentsList(page: Page) {
  await page.goto('/dashboard/config');
  await expect(page.getByText('Active Agents')).toBeVisible({
    timeout: 15_000,
  });
}

async function createSandboxAgent(page: Page, name: string) {
  await gotoAgentsList(page);
  await page
    .getByRole('button', { name: 'New Agent', exact: true })
    .first()
    .click();
  await expect(page.getByText('Choose a starting strategy')).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Agent identity')).toBeVisible();
  await page.getByPlaceholder('e.g. BTC Aggressive').fill(name);
  await page.getByRole('button', { name: 'BTC', exact: true }).click();
  await page.getByRole('button', { name: 'USDT', exact: true }).click();

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByText('Review and create')).toBeVisible();

  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/trading/config') && r.request().method() === 'POST',
      { timeout: 20_000 },
    ),
    page.getByRole('button', { name: 'Create Agent', exact: true }).click(),
  ]);
  expect(response.status()).toBeLessThan(400);
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1: Autenticación
// ─────────────────────────────────────────────────────────────────────────────
test.describe('1 — Autenticación (trader@crypto.com)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login exitoso redirige al dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(TRADER_EMAIL);
    await page.locator('input[type="password"]').fill(TRADER_PASSWORD);
    await page
      .getByRole('main')
      .getByRole('button', { name: /sign in/i })
      .click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
  });

  test('credenciales incorrectas NO redirigen al dashboard', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill(TRADER_EMAIL);
    await page.locator('input[type="password"]').fill('WrongPassword!');
    await page
      .getByRole('main')
      .getByRole('button', { name: /sign in/i })
      .click();
    await expect(
      page
        .locator(
          '[role="alert"], .error, [data-sonner-toast], [class*="red-500"]',
        )
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2: Configuración del agente (stepper "New Agent")
// ─────────────────────────────────────────────────────────────────────────────
test.describe('2 — Configuración del agente', () => {
  test.use({ storageState: TRADER_STATE });

  test('página de config carga con heading visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(
      page.locator('h1').filter({ hasText: /manage agents/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('selector de asset BTC y ETH son visibles en el stepper', async ({
    page,
  }) => {
    await gotoAgentsList(page);
    await page
      .getByRole('button', { name: 'New Agent', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'BTC', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: 'ETH', exact: true }),
    ).toBeVisible();
  });

  test('selector de par USDT y USDC son visibles en el stepper', async ({
    page,
  }) => {
    await gotoAgentsList(page);
    await page
      .getByRole('button', { name: 'New Agent', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'USDT', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: 'USDC', exact: true }),
    ).toBeVisible();
  });

  test('el modo del agente lo fija el modo de operación global (SANDBOX)', async ({
    page,
  }) => {
    await gotoAgentsList(page);
    await page
      .getByRole('button', { name: 'New Agent', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('No risk', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText('SANDBOX', { exact: true }).last(),
    ).toBeVisible();
  });

  test('sliders de configuración son visibles y modificables', async ({
    page,
  }) => {
    await gotoAgentsList(page);
    await page
      .getByRole('button', { name: 'New Agent', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Decision thresholds')).toBeVisible({
      timeout: 10_000,
    });
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeVisible();
    expect(await sliders.count()).toBeGreaterThanOrEqual(2);
    await sliders.first().fill('75');
    await expect(sliders.first()).toHaveValue('75');
  });

  test('crear un agente BTC/USDT SANDBOX lo agrega a Active Agents', async ({
    page,
  }) => {
    const name = `E2E BTC ${Date.now()}`;
    await createSandboxAgent(page, name);

    const createdRow = page
      .locator('div.flex.items-center.gap-4')
      .filter({ hasText: name });
    await expect(createdRow).toBeVisible({ timeout: 15_000 });

    // El agente creado se borra para no acumular configs entre corridas
    await createdRow
      .getByRole('button', { name: 'Delete Configuration' })
      .click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(createdRow).toHaveCount(0, { timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3: Arranque del agente
// ─────────────────────────────────────────────────────────────────────────────
test.describe('3 — Arranque del agente', () => {
  test.use({ storageState: TRADER_STATE });

  test('el botón de detalle abre el AgentDetailModal', async ({ page }) => {
    await gotoAgentsList(page);
    const row = agentRow(page);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: 'View detail' }).click();
    await expect(page.getByText(/BTC\/USDT/).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Start Agent inicia el agente y el badge pasa a Running', async ({
    page,
  }) => {
    await gotoAgentsList(page);
    const row = agentRow(page);
    await expect(row).toBeVisible({ timeout: 15_000 });

    const stopBtn = row.getByRole('button', { name: 'Stop Agent' });
    if ((await stopBtn.count()) > 0) {
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/trading/stop') && r.status() < 400,
          { timeout: 20_000 },
        ),
        stopBtn.click(),
      ]);
    }

    const startBtn = row.getByRole('button', { name: 'Start Agent' });
    await expect(startBtn).toBeVisible({ timeout: 15_000 });
    const [startResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/trading/start') && r.status() < 400,
        { timeout: 30_000 },
      ),
      startBtn.click(),
    ]);
    expect(startResp.status()).toBeLessThan(400);

    await expect(row.getByText('Running', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 4: Agent Log
// ─────────────────────────────────────────────────────────────────────────────
test.describe('4 — Agent Log (/dashboard/agent-log)', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/agent-log');
    await expect(
      page.locator('h1').filter({ hasText: /agent log/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(AGENT_LOG_SKELETON)).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test('heading "Agent Log" es visible', async ({ page }) => {
    await expect(
      page.locator('h1').filter({ hasText: /agent log/i }),
    ).toBeVisible();
  });

  test('muestra estado vacío o tarjetas de decisión', async ({ page }) => {
    const cards = await page.locator('.decision-card').count();
    const empty = await page.locator('[class*="border-dashed"]').count();
    expect(cards > 0 || empty > 0).toBe(true);
  });

  test('los skeletons de carga desaparecen tras cargar datos', async ({
    page,
  }) => {
    await expect(page.locator(AGENT_LOG_SKELETON)).toHaveCount(0);
  });

  test('las tarjetas de decisión muestran badge de acción si existen', async ({
    page,
  }) => {
    const cards = page.locator('.decision-card');
    if ((await cards.count()) > 0) {
      await expect(
        cards.first().locator('.text-xs.font-bold.uppercase').first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('barra de confianza renderiza en las tarjetas de decisión', async ({
    page,
  }) => {
    const cards = page.locator('.decision-card');
    if ((await cards.count()) > 0) {
      await expect(
        cards.first().locator('[class*="bg-primary"]').first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 5: Posiciones
// ─────────────────────────────────────────────────────────────────────────────
test.describe('5 — Posiciones (/dashboard/positions)', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/positions');
    await expect(
      page.locator('h1').filter({ hasText: /positions/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(POSITIONS_SKELETON)).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test('heading "Positions" es visible', async ({ page }) => {
    await expect(
      page.locator('h1').filter({ hasText: /positions/i }),
    ).toBeVisible();
  });

  test('tabs Open y Closed son visibles y alternables', async ({ page }) => {
    const openTab = page.getByRole('button', { name: 'Open', exact: true });
    const closedTab = page.getByRole('button', { name: 'Closed', exact: true });
    await expect(openTab).toBeVisible();
    await expect(closedTab).toBeVisible();
    await closedTab.click();
    await expect(closedTab).toHaveClass(/bg-background/);
    await openTab.click();
    await expect(openTab).toHaveClass(/bg-background/);
  });

  test('muestra tabla o estado vacío en tab OPEN', async ({ page }) => {
    const table = await page.locator('table').count();
    const empty = await page.locator('[class*="border-dashed"]').count();
    expect(table > 0 || empty > 0).toBe(true);
  });

  test('los skeletons desaparecen tras cargar', async ({ page }) => {
    await expect(page.locator(POSITIONS_SKELETON)).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 6: Cierre manual de posición (condicional)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('6 — Cierre manual de posición (si existe)', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/positions');
    await expect(page.locator(POSITIONS_SKELETON)).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test('botón Close abre dialog de confirmación con detalles de la posición', async ({
    page,
  }) => {
    const closeBtn = page
      .locator('.position-row')
      .first()
      .getByRole('button', { name: /close/i })
      .first();
    test.skip(
      (await closeBtn.count()) === 0,
      'El usuario no tiene posiciones abiertas para cerrar.',
    );

    await closeBtn.click();
    await expect(page.getByText(/close position/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('cancelar el dialog NO cierra la posición', async ({ page }) => {
    const closeBtn = page
      .locator('.position-row')
      .first()
      .getByRole('button', { name: /close/i })
      .first();
    test.skip(
      (await closeBtn.count()) === 0,
      'El usuario no tiene posiciones abiertas para cerrar.',
    );

    await closeBtn.click();
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();
    await expect(page.getByText(/close position/i).first()).not.toBeVisible({
      timeout: 5_000,
    });
    await expect(closeBtn).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 7: Parada del agente
// ─────────────────────────────────────────────────────────────────────────────
test.describe('7 — Parada del agente', () => {
  test.use({ storageState: TRADER_STATE });

  test('Stop Agent detiene el agente y el badge cambia a Stopped', async ({
    page,
  }) => {
    await gotoAgentsList(page);
    const row = agentRow(page);
    await expect(row).toBeVisible({ timeout: 15_000 });

    const startBtn = row.getByRole('button', { name: 'Start Agent' });
    if ((await startBtn.count()) > 0) {
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/trading/start') && r.status() < 400,
          { timeout: 30_000 },
        ),
        startBtn.click(),
      ]);
    }

    const stopBtn = row.getByRole('button', { name: 'Stop Agent' });
    await expect(stopBtn).toBeVisible({ timeout: 20_000 });
    const [stopResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/trading/stop') && r.status() < 400,
        { timeout: 30_000 },
      ),
      stopBtn.click(),
    ]);
    expect(stopResp.status()).toBeLessThan(400);

    await expect(row.getByText('Stopped', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });
});
