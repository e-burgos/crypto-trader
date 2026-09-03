/**
 * Configuración avanzada del agente — paso "Advanced settings" del stepper de alta.
 *
 * Recorre el alta hasta el paso avanzado, enciende un interruptor por sección
 * (Protección, Señal y tamaño, Loop reactivo) y confirma que el control dependiente
 * se habilita en el DOM; en Entrada, con el modo global SANDBOX del usuario trader,
 * confirma que el select queda deshabilitado con su explicación visible en vez de
 * encenderse. Verifica el resumen del paso de revisión y, tras crear el agente,
 * confirma vía API que los valores encendidos quedaron persistidos.
 */
import { test, expect, type Page } from '@playwright/test';

const TRADER_STATE = 'e2e/.auth/trader.json';
const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3000/api';

test.use({ storageState: TRADER_STATE });

async function getAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  if (!token) throw new Error('No hay accessToken en localStorage para el usuario trader');
  return token;
}

async function openNewAgentModal(page: Page) {
  await page.goto('/dashboard/config');
  await expect(page.getByText('Active Agents')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'New Agent', exact: true }).first().click();
  await expect(page.getByText('Choose a starting strategy')).toBeVisible({
    timeout: 10_000,
  });
}

async function goToAdvancedStep(page: Page, name: string) {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Agent identity')).toBeVisible();
  await page.getByPlaceholder('e.g. BTC Aggressive').fill(name);

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByText('Advanced settings')).toBeVisible({ timeout: 10_000 });
}

function agentRow(page: Page, name: string) {
  return page.locator('div.flex.items-center.gap-4').filter({ hasText: name });
}

async function deleteAgent(page: Page, name: string) {
  const row = agentRow(page, name);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: 'Delete Configuration' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row).toHaveCount(0, { timeout: 15_000 });
}

test.describe('Agent advanced config — alta con la sección Avanzado', () => {
  test('un alta que no toca lo avanzado llega a revisión con "No changes" (CA-002)', async ({
    page,
  }) => {
    await openNewAgentModal(page);
    await goToAdvancedStep(page, `E2E Advanced Skip ${Date.now()}`);

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Review and create')).toBeVisible();
    await expect(page.getByText('No changes')).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('encender un interruptor por sección habilita su control dependiente, y el agente creado los persiste (CA-002, CA-004)', async ({
    page,
  }) => {
    const name = `E2E Advanced ${Date.now()}`;
    await openNewAgentModal(page);
    await goToAdvancedStep(page, name);

    await page.getByRole('button', { name: 'Protection' }).click();
    await expect(page.locator('#stopLimitOffsetPct')).toBeDisabled();
    await page.getByRole('switch', { name: 'Native OCO protection' }).click();
    await expect(page.locator('#stopLimitOffsetPct')).toBeEnabled();

    await page.getByRole('button', { name: 'Signal & sizing' }).click();
    await expect(page.locator('#lossCutConfidenceThreshold')).toBeDisabled();
    await page.getByRole('switch', { name: 'Signal loss cut' }).click();
    await expect(page.locator('#lossCutConfidenceThreshold')).toBeEnabled();

    await page.getByRole('button', { name: 'Reactive loop' }).click();
    await expect(page.locator('#maxActionsPerHour')).toBeDisabled();
    await page.getByRole('switch', { name: 'Reactive loop' }).click();
    await expect(page.locator('#maxActionsPerHour')).toBeEnabled();

    await page.getByRole('button', { name: 'Entry' }).click();
    await expect(
      page.getByRole('button', { name: 'Market', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Resting entries don't apply in SANDBOX"),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Review and create')).toBeVisible();
    await expect(page.getByText('3 settings')).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/trading/config') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      page.getByRole('button', { name: 'Create Agent', exact: true }).click(),
    ]);
    expect(response.status()).toBeLessThan(400);
    const created = (await response.json()) as { id: string };

    const createdRow = agentRow(page, name);
    await expect(createdRow).toBeVisible({ timeout: 15_000 });

    const token = await getAccessToken(page);
    const configsRes = await page.request.get(`${API_BASE}/trading/config`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15_000,
    });
    expect(configsRes.ok()).toBe(true);
    const configs = (await configsRes.json()) as Array<Record<string, unknown>>;
    const persisted = configs.find((c) => c['id'] === created.id);
    expect(persisted).toBeTruthy();
    expect(persisted?.['nativeProtectionEnabled']).toBe(true);
    expect(persisted?.['lossCutEnabled']).toBe(true);
    expect(persisted?.['reactiveLoopEnabled']).toBe(true);
    expect(persisted?.['entryOrderMode']).toBe('MARKET');

    await deleteAgent(page, name);
  });
});
