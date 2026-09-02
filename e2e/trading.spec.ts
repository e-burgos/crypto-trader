import { test, expect, Page } from '@playwright/test';

/** The inline config form was replaced by the "New Agent" stepper modal:
 *  step 1 picks a preset, step 2 (identity) holds asset / pair / mode. */
async function openIdentityStep(page: Page) {
  await page.goto('/dashboard/config');
  await page.getByRole('button', { name: 'New Agent', exact: true }).first().click();
  await expect(
    page.getByText('Choose a starting strategy'),
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Agent identity')).toBeVisible();
}

test.describe('Trading Config — page', () => {
  test('config page heading is visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(
      page.locator('h1').filter({ hasText: /manage agents/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('opens the New Agent stepper on the preset step', async ({ page }) => {
    await page.goto('/dashboard/config');
    await page
      .getByRole('button', { name: 'New Agent', exact: true })
      .first()
      .click();
    await expect(page.getByText('Choose a starting strategy')).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Trading Config — New Agent stepper', () => {
  test('asset selector (BTC/ETH) buttons are visible', async ({ page }) => {
    await openIdentityStep(page);
    await expect(
      page.getByRole('button', { name: 'BTC', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'ETH', exact: true }),
    ).toBeVisible();
  });

  test('pair selector (USDT/USDC) buttons are visible', async ({ page }) => {
    await openIdentityStep(page);
    await expect(
      page.getByRole('button', { name: 'USDT', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'USDC', exact: true }),
    ).toBeVisible();
  });

  test('mode mirrors the global operation mode instead of being picked here', async ({
    page,
  }) => {
    await openIdentityStep(page);
    const noRisk = page.getByText('No risk', { exact: true });
    await expect(noRisk).toBeVisible();
    await expect(
      page.getByText('SANDBOX', { exact: true }).last(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'LIVE', exact: true }),
    ).toHaveCount(0);
  });

  test('selecting ETH marks it as the active asset', async ({ page }) => {
    await openIdentityStep(page);
    const eth = page.getByRole('button', { name: 'ETH', exact: true });
    await eth.click();
    await expect(eth).toHaveClass(/bg-primary\/10/);
    await expect(
      page.getByRole('button', { name: 'BTC', exact: true }),
    ).not.toHaveClass(/bg-primary\/10/);
  });

  test('selecting USDC marks it as the active pair', async ({ page }) => {
    await openIdentityStep(page);
    const usdc = page.getByRole('button', { name: 'USDC', exact: true });
    await usdc.click();
    await expect(usdc).toHaveClass(/bg-primary\/10/);
    await expect(
      page.getByRole('button', { name: 'USDT', exact: true }),
    ).not.toHaveClass(/bg-primary\/10/);
  });

  test('threshold sliders are visible and can be changed', async ({ page }) => {
    await openIdentityStep(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Decision thresholds')).toBeVisible();
    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible();
    await slider.fill('80');
    await expect(slider).toHaveValue('80');
  });

  test('the last step offers Create Agent', async ({ page }) => {
    await openIdentityStep(page);
    for (const step of [
      'Decision thresholds',
      'Risk management',
      'Timing and positions',
      'Review and create',
    ]) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText(step)).toBeVisible();
    }
    await expect(
      page.getByRole('button', { name: 'Create Agent', exact: true }),
    ).toBeVisible();
  });
});

test.describe('Trading Config — Saved configs list', () => {
  test('shows the agents list or the empty state', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByText('Active Agents')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Start Agent button visible when a config exists', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByText('Active Agents')).toBeVisible({
      timeout: 15_000,
    });
    const startBtn = page.getByRole('button', { name: /start agent/i });
    if ((await startBtn.count()) > 0) {
      await expect(startBtn.first()).toBeVisible();
    }
  });

  test('Stop Agent button visible when agent is running', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByText('Active Agents')).toBeVisible({
      timeout: 15_000,
    });
    const stopBtn = page.getByRole('button', { name: /stop agent/i });
    if ((await stopBtn.count()) > 0) {
      await expect(stopBtn.first()).toBeVisible();
    }
  });
});

test.describe('Analytics', () => {
  test('/dashboard/analytics redirects to the Overview', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
    await expect(page.getByText(/portfolio overview/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Overview renders P&L / win rate metrics', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(
      page.getByText(/p&l|profit|win rate|volume|fees/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Overview renders recharts containers after data loads', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/portfolio overview/i)).toBeVisible({
      timeout: 15_000,
    });
    const charts = page.locator(
      '.recharts-responsive-container, svg.recharts-surface',
    );
    if ((await charts.count()) > 0) {
      await expect(charts.first()).toBeVisible();
    }
  });
});
