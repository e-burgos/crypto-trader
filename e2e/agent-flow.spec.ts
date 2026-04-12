/**
 * Spec 19 — Flujo completo del agente de trading (admin@crypto.com)
 *
 * Cubre: login → configurar agente → arrancar → agent log → posiciones → cerrar posición → detener
 */
import { test, expect, type Page } from '@playwright/test';

// ── Admin credentials (seed) ──────────────────────────────────────────────────
const ADMIN_EMAIL = 'admin@crypto.com';
const ADMIN_PASSWORD = 'Admin1234!';

// ── Bypass shared storage state — autenticación propia ────────────────────────
test.use({ storageState: { cookies: [], origins: [] } });

// ── Helper: login ─────────────────────────────────────────────────────────────
async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page
    .getByRole('main')
    .getByRole('button', { name: /sign in/i })
    .click();
  await page.waitForURL('**/dashboard**', { timeout: 12_000 });
  await expect(page).toHaveURL(/dashboard/);
}

// ── Helper: crear/actualizar config BTC/USDT/SANDBOX via formulario escopado ──
async function ensureConfigExists(page: Page) {
  await page.goto('/dashboard/config');
  const form = page.locator('form').first();
  await form.getByRole('button', { name: 'BTC', exact: true }).click();
  await form.getByRole('button', { name: 'USDT', exact: true }).click();
  await form.getByRole('button', { name: 'Sandbox', exact: true }).click();
  const saveBtn = form.getByRole('button', { name: /save|guardar/i });
  await saveBtn.click();
  await page.waitForTimeout(1_500);
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1: Autenticación
// ─────────────────────────────────────────────────────────────────────────────
test.describe('1 — Autenticación (admin@crypto.com)', () => {
  test('login exitoso redirige al dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/dashboard/);
  });

  test('credenciales incorrectas NO redirigen al dashboard', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill('WrongPassword!');
    await page
      .getByRole('main')
      .getByRole('button', { name: /sign in/i })
      .click();
    await page.waitForTimeout(2_500);
    const url = page.url();
    expect(url.includes('login') || !url.includes('dashboard')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2: Configuración del agente
// ─────────────────────────────────────────────────────────────────────────────
test.describe('2 — Configuración del agente', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('página de config carga con heading visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByRole('heading', { name: /config/i })).toBeVisible({
      timeout: 8_000,
    });
  });

  test('selector de asset BTC y ETH son visibles en el formulario', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    const form = page.locator('form').first();
    await expect(
      form.getByRole('button', { name: 'BTC', exact: true }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      form.getByRole('button', { name: 'ETH', exact: true }),
    ).toBeVisible();
  });

  test('selector de par USDT y USDC son visibles en el formulario', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    const form = page.locator('form').first();
    await expect(
      form.getByRole('button', { name: 'USDT', exact: true }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      form.getByRole('button', { name: 'USDC', exact: true }),
    ).toBeVisible();
  });

  test('selector de modo Sandbox y Live son visibles en el formulario', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    const form = page.locator('form').first();
    await expect(
      form.getByRole('button', { name: 'Sandbox', exact: true }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(form.getByRole('button', { name: /^live$/i })).toBeVisible();
  });

  test('sliders de configuración son visibles y modificables', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeVisible({ timeout: 8_000 });
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Modifica el primer slider
    await sliders.first().fill('75');
    await page.waitForTimeout(200);
    expect(await sliders.first().inputValue()).toBe('75');
  });

  test('guardar config BTC/USDT/SANDBOX persiste y la tarjeta aparece en Active Agents', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    const form = page.locator('form').first();

    // Seleccionar BTC / USDT / Sandbox dentro del formulario (scoped)
    await form.getByRole('button', { name: 'BTC', exact: true }).click();
    await form.getByRole('button', { name: 'USDT', exact: true }).click();
    await form.getByRole('button', { name: 'Sandbox', exact: true }).click();

    // Guardar configuración
    const saveBtn = form.getByRole('button', { name: /save|guardar/i });
    await expect(saveBtn).toBeVisible({ timeout: 6_000 });

    // Interceptar la respuesta de guardado
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/trading/config') && r.status() < 400,
        { timeout: 10_000 },
      ),
      saveBtn.click(),
    ]);
    expect(response.status()).toBeLessThan(400);

    // La tarjeta de configuración debe aparecer en Active Agents
    await expect(
      page
        .locator('li')
        .filter({ hasText: /BTC\/USDT/i })
        .first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3: Arranque del agente
// ─────────────────────────────────────────────────────────────────────────────
test.describe('3 — Arranque del agente', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await ensureConfigExists(page);
  });

  test('click en tarjeta de config abre el AgentDetailModal', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    const configCard = page
      .locator('li')
      .filter({ hasText: /BTC\/USDT/i })
      .locator('button')
      .first();
    await expect(configCard).toBeVisible({ timeout: 8_000 });
    await configCard.click();

    // El modal muestra el heading BTC/USDT
    await expect(
      page
        .locator('[class*="rounded-2xl"]')
        .filter({ hasText: /BTC.*USDT/i })
        .last(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Start Agent inicia el agente y el badge pasa a Running', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    const configCard = page
      .locator('li')
      .filter({ hasText: /BTC\/USDT/i })
      .locator('button')
      .first();
    await expect(configCard).toBeVisible({ timeout: 8_000 });
    await configCard.click();

    // Si ya está corriendo, detener primero
    const stopBtnVisible = await page
      .getByRole('button', { name: /stop agent|detener/i })
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (stopBtnVisible) {
      const [stopResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/trading/stop') && r.status() < 400,
          { timeout: 10_000 },
        ),
        page.getByRole('button', { name: /stop agent|detener/i }).click(),
      ]);
      expect(stopResp.status()).toBeLessThan(400);
      await page.waitForTimeout(1_500);
      await configCard.click();
    }

    const startBtn = page.getByRole('button', { name: /start agent|iniciar/i });
    await expect(startBtn).toBeVisible({ timeout: 5_000 });

    const [startResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/trading/start') && r.status() < 400,
        { timeout: 12_000 },
      ),
      startBtn.click(),
    ]);
    expect(startResp.status()).toBeLessThan(400);

    await page.waitForTimeout(1_500);
    await expect(
      page
        .locator('li')
        .filter({ hasText: /BTC\/USDT/i })
        .getByText(/running|corriendo/i)
        .first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 4: Agent Log
// ─────────────────────────────────────────────────────────────────────────────
test.describe('4 — Agent Log (/dashboard/agent)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('heading "Agent Log" es visible', async ({ page }) => {
    await page.goto('/dashboard/agent');
    await expect(
      page.locator('h1').filter({ hasText: /agent log/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('muestra estado vacío o tarjetas de decisión', async ({ page }) => {
    await page.goto('/dashboard/agent');
    await page.waitForTimeout(3_500);
    const hasCards = await page
      .locator('.decision-card')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .locator('[class*="border-dashed"]')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
  });

  test('los skeletons de carga desaparecen tras cargar datos', async ({
    page,
  }) => {
    await page.goto('/dashboard/agent');
    await expect(page.locator('.animate-pulse')).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test('las tarjetas de decisión muestran badge de acción si existen', async ({
    page,
  }) => {
    await page.goto('/dashboard/agent');
    await page.waitForTimeout(3_500);
    const cards = page.locator('.decision-card');
    if ((await cards.count()) > 0) {
      // El badge tiene clase text-xs font-bold uppercase
      await expect(
        cards.first().locator('.text-xs.font-bold.uppercase').first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('barra de confianza renderiza en las tarjetas de decisión', async ({
    page,
  }) => {
    await page.goto('/dashboard/agent');
    await page.waitForTimeout(3_500);
    const cards = page.locator('.decision-card');
    if ((await cards.count()) > 0) {
      // La barra de confianza tiene clase bg-primary
      await expect(cards.first().locator('[class*="bg-primary"]')).toBeVisible({
        timeout: 5_000,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 5: Posiciones
// ─────────────────────────────────────────────────────────────────────────────
test.describe('5 — Posiciones (/dashboard/positions)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('heading "Positions" es visible', async ({ page }) => {
    await page.goto('/dashboard/positions');
    await expect(page.getByRole('heading', { name: /positions/i })).toBeVisible(
      { timeout: 8_000 },
    );
  });

  test('tabs Open y Closed son visibles y alternables', async ({ page }) => {
    await page.goto('/dashboard/positions');
    const openTab = page
      .locator('button')
      .filter({ hasText: /^Open$/i })
      .first();
    const closedTab = page
      .locator('button')
      .filter({ hasText: /^Closed$/i })
      .first();
    await expect(openTab).toBeVisible({ timeout: 8_000 });
    await expect(closedTab).toBeVisible();
    await closedTab.click();
    await page.waitForTimeout(400);
    await openTab.click();
    await page.waitForTimeout(400);
  });

  test('muestra tabla o estado vacío en tab OPEN', async ({ page }) => {
    await page.goto('/dashboard/positions');
    await page.waitForTimeout(3_500);
    const hasTable = await page
      .locator('table')
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .locator('[class*="border-dashed"]')
      .isVisible()
      .catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('los skeletons desaparecen tras cargar', async ({ page }) => {
    await page.goto('/dashboard/positions');
    await expect(page.locator('.animate-pulse')).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 6: Cierre manual de posición (condicional)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('6 — Cierre manual de posición (si existe)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('botón Close abre dialog de confirmación con detalles de la posición', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions');
    await page.waitForTimeout(3_500);
    const closeBtn = page
      .locator('.position-row')
      .first()
      .locator('button')
      .filter({ hasText: /close/i })
      .first();
    if (!(await closeBtn.isVisible().catch(() => false))) return;

    await closeBtn.click();
    await expect(page.getByText(/close position\?|cerrar posici/i)).toBeVisible(
      { timeout: 5_000 },
    );
  });

  test('cancelar el dialog NO cierra la posición', async ({ page }) => {
    await page.goto('/dashboard/positions');
    await page.waitForTimeout(3_500);
    const closeBtn = page
      .locator('.position-row')
      .first()
      .locator('button')
      .filter({ hasText: /close/i })
      .first();
    if (!(await closeBtn.isVisible().catch(() => false))) return;

    await closeBtn.click();
    const cancelBtn = page.getByRole('button', { name: /cancel|cancelar/i });
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
    await cancelBtn.click();
    await expect(
      page.getByText(/close position\?|cerrar posici/i),
    ).not.toBeVisible({ timeout: 3_000 });
    await expect(closeBtn).toBeVisible({ timeout: 3_000 });
  });

  test('confirmar "Close now" ejecuta la venta y pasa la posición a tab Closed', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions');
    await page.waitForTimeout(3_500);
    const closeBtn = page
      .locator('.position-row')
      .first()
      .locator('button')
      .filter({ hasText: /close/i })
      .first();
    if (!(await closeBtn.isVisible().catch(() => false))) return;

    await closeBtn.click();
    // El dialog de confirmación tiene z-50 — scope exacto al overlay con ese z-index
    const dialog = page.locator('div.fixed.inset-0.z-50');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const confirmBtn = dialog.locator('button').last();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });

    const [closeResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/positions/') &&
          r.url().includes('/close') &&
          r.status() < 400,
        { timeout: 15_000 },
      ),
      confirmBtn.click(),
    ]);
    expect(closeResp.status()).toBeLessThan(400);

    await page.waitForTimeout(1_000);
    await page
      .locator('button')
      .filter({ hasText: /^Closed$/i })
      .first()
      .click();
    await page.waitForTimeout(2_000);
    expect(await page.locator('table tbody tr').count()).toBeGreaterThanOrEqual(
      1,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 7: Parada del agente
// ─────────────────────────────────────────────────────────────────────────────
test.describe('7 — Parada del agente', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await ensureConfigExists(page);
  });

  test('Stop Agent detiene el agente y el badge cambia a Stopped', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    const configCard = page
      .locator('li')
      .filter({ hasText: /BTC\/USDT/i })
      .locator('button')
      .first();
    await expect(configCard).toBeVisible({ timeout: 8_000 });
    await configCard.click();

    // Si no está corriendo, iniciarlo primero
    const startBtnVisible = await page
      .getByRole('button', { name: /start agent|iniciar/i })
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (startBtnVisible) {
      const [startResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/trading/start') && r.status() < 400,
          { timeout: 12_000 },
        ),
        page.getByRole('button', { name: /start agent|iniciar/i }).click(),
      ]);
      expect(startResp.status()).toBeLessThan(400);
      await page.waitForTimeout(1_500);
      await configCard.click();
    }

    const stopBtn = page.getByRole('button', { name: /stop agent|detener/i });
    await expect(stopBtn).toBeVisible({ timeout: 5_000 });

    const [stopResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/trading/stop') && r.status() < 400,
        { timeout: 12_000 },
      ),
      stopBtn.click(),
    ]);
    expect(stopResp.status()).toBeLessThan(400);

    await page.waitForTimeout(1_500);
    await expect(
      page
        .locator('li')
        .filter({ hasText: /BTC\/USDT/i })
        .getByText(/stopped|detenido/i)
        .first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});
