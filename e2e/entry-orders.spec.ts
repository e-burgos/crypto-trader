/**
 * Positions — pestaña Entradas (CA-008)
 *
 * El trader sembrado opera en SANDBOX y no tiene ni puede tener entradas
 * (H5): este spec no afirma el render de una fila ni el paginado real, sólo
 * la pestaña, el estado vacío, los filtros por URL y el deep link.
 */
import { test, expect, type Page } from '@playwright/test';

const TRADER_STATE = 'e2e/.auth/trader.json';
const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3000/api';

test.use({ storageState: TRADER_STATE });

async function getAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  if (!token) throw new Error('No accessToken en localStorage para el trader');
  return token;
}

let seededConfigId: string;
let seededConfigName: string;
let createdBySpec = false;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: TRADER_STATE });
  const page = await context.newPage();
  await page.goto('/dashboard/positions');
  const token = await getAccessToken(page);

  const listRes = await page.request.get(`${API_BASE}/trading/config`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15_000,
  });
  expect(listRes.ok()).toBe(true);
  const configs = (await listRes.json()) as Array<Record<string, unknown>>;

  const existing = configs[0];
  if (existing) {
    seededConfigId = existing['id'] as string;
    seededConfigName =
      (existing['name'] as string) || `${existing['asset']}/${existing['pair']}`;
  } else {
    seededConfigName = `E2E Entries ${Date.now()}`;
    const createRes = await page.request.post(`${API_BASE}/trading/config`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: { asset: 'BTC', pair: 'USDT', mode: 'SANDBOX', name: seededConfigName },
      timeout: 15_000,
    });
    expect(createRes.ok()).toBe(true);
    const created = (await createRes.json()) as { id: string };
    seededConfigId = created.id;
    createdBySpec = true;
  }

  await context.close();
});

test.afterAll(async ({ browser }) => {
  if (!createdBySpec) return;
  const context = await browser.newContext({ storageState: TRADER_STATE });
  const page = await context.newPage();
  await page.goto('/dashboard/positions');
  const token = await getAccessToken(page);
  await page.request.delete(`${API_BASE}/trading/config/${seededConfigId}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15_000,
  });
  await context.close();
});

// ── Monitor de consola ───────────────────────────────────────────────────────
let consoleErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const resourceUrl = msg.location()?.url ?? '';
    consoleErrors.push(
      resourceUrl ? `${msg.text()} @ ${resourceUrl}` : msg.text(),
    );
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
      !e.includes('/api/market/') &&
      !e.includes('[vite]') &&
      !e.includes('favicon'),
  );
  expect(
    realErrors,
    `Errores de consola:\n${realErrors.join('\n')}`,
  ).toHaveLength(0);
});

const NUMBERED_PAGINATION = /^\d+ \/ \d+$/;

test.describe('Positions — pestaña Entries', () => {
  test('la pestaña Entries es visible junto a Open y Closed, Open activa por default', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions');
    await expect(
      page.locator('h1').filter({ hasText: /positions/i }),
    ).toBeVisible({ timeout: 15_000 });

    const openTab = page.getByRole('button', { name: 'Open', exact: true });
    const closedTab = page.getByRole('button', { name: 'Closed', exact: true });
    const entriesTab = page.getByRole('button', { name: 'Entries', exact: true });
    await expect(openTab).toBeVisible();
    await expect(closedTab).toBeVisible();
    await expect(entriesTab).toBeVisible();
    await expect(openTab).toHaveClass(/bg-background/);
  });

  test('clickear Entries pasa a ?tab=entries, muestra el estado vacío y esconde el paginado por número', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions');
    await page.getByRole('button', { name: 'Entries', exact: true }).click();

    await expect(page).toHaveURL(/[?&]tab=entries/);
    await expect(
      page.getByRole('heading', { name: 'No resting entries' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByText(NUMBERED_PAGINATION)).toHaveCount(0);
  });

  test('clickear la pastilla Missing agrega status=MISSING a la URL y deja aria-pressed', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions?tab=entries');
    const statusGroup = page.getByRole('group');
    const allPill = statusGroup.getByRole('button', { name: 'All', exact: true });
    const missingPill = statusGroup.getByRole('button', {
      name: 'Missing',
      exact: true,
    });
    await expect(allPill).toBeVisible();
    await expect(allPill).toHaveAttribute('aria-pressed', 'true');

    await missingPill.click();
    await expect(page).toHaveURL(/[?&]tab=entries/);
    await expect(page).toHaveURL(/[?&]status=MISSING/);
    await expect(missingPill).toHaveAttribute('aria-pressed', 'true');
    await expect(allPill).toHaveAttribute('aria-pressed', 'false');
  });

  test('las seis pastillas de estado son visibles', async ({ page }) => {
    await page.goto('/dashboard/positions?tab=entries');
    const statusGroup = page.getByRole('group');
    const labels = ['All', 'Resting', 'Filled', 'Cancelled', 'Expired', 'Missing'];
    for (const label of labels) {
      await expect(
        statusGroup.getByRole('button', { name: label, exact: true }),
      ).toBeVisible();
    }
  });

  test('el select de bot lista al menos las configs sembradas del trader', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions?tab=entries');
    await page.getByRole('button', { name: 'All bots', exact: true }).click();
    await expect(
      page.getByRole('button', { name: seededConfigName, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('deep link con status=RESTING y configId preselecciona la pastilla y el bot', async ({
    page,
  }) => {
    await page.goto(
      `/dashboard/positions?tab=entries&status=RESTING&configId=${seededConfigId}`,
    );

    const entriesTab = page.getByRole('button', { name: 'Entries', exact: true });
    await expect(entriesTab).toHaveClass(/bg-background/);

    const statusGroup = page.getByRole('group');
    const restingPill = statusGroup.getByRole('button', {
      name: 'Resting',
      exact: true,
    });
    await expect(restingPill).toHaveAttribute('aria-pressed', 'true', {
      timeout: 10_000,
    });

    await expect(
      page.getByRole('button', { name: seededConfigName, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('un tab inválido en el deep link cae en Open, sin error de consola', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions?tab=bogus');
    const openTab = page.getByRole('button', { name: 'Open', exact: true });
    await expect(openTab).toHaveClass(/bg-background/, { timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: 'Entries', exact: true }),
    ).not.toHaveClass(/bg-background/);
  });

  test('no hay control de "cargar más" con la lista vacía', async ({ page }) => {
    await page.goto('/dashboard/positions?tab=entries');
    await expect(
      page.getByRole('heading', { name: 'No resting entries' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: 'Load more', exact: true }),
    ).toHaveCount(0);
  });

  test('sonda de contrato: GET /trading/entry-orders responde 200 con items array y nextCursor', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions?tab=entries');
    const token = await getAccessToken(page);
    const res = await page.request.get(`${API_BASE}/trading/entry-orders`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15_000,
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as {
      items: unknown[];
      nextCursor: string | null;
    };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === 'string').toBe(
      true,
    );
  });

  test('volver a Open restaura la tabla o el estado vacío de posiciones y limpia status/configId de la URL', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions?tab=entries&status=MISSING');
    await page.getByRole('button', { name: 'Open', exact: true }).click();

    await expect(page).toHaveURL(/[?&]tab=open/);
    await expect(page).not.toHaveURL(/status=/);
    await expect(page).not.toHaveURL(/configId=/);

    await expect(async () => {
      const skeleton = await page
        .locator('.animate-pulse.rounded-lg.bg-muted')
        .count();
      const table = await page.locator('table').count();
      const empty = await page.locator('[class*="border-dashed"]').count();
      expect(skeleton).toBe(0);
      expect(table > 0 || empty > 0).toBe(true);
    }).toPass({ timeout: 15_000 });
  });
});
