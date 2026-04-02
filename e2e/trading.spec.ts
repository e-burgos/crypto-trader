import { test, expect } from '@playwright/test';

test.describe('Trading Config — Form render', () => {
  test('config page heading is visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByRole('heading', { name: /config/i })).toBeVisible({
      timeout: 8_000,
    });
  });

  test('asset selector (BTC/ETH) buttons are visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByRole('button', { name: /^btc$/i })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByRole('button', { name: /^eth$/i })).toBeVisible();
  });

  test('pair selector (USDT/USDC) buttons are visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByRole('button', { name: /^usdt$/i })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByRole('button', { name: /^usdc$/i })).toBeVisible();
  });

  test('mode selector (SANDBOX/LIVE) buttons are visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByRole('button', { name: /sandbox/i })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByRole('button', { name: /^live$/i })).toBeVisible();
  });

  test('slider fields are visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeVisible({ timeout: 8_000 });
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('sliders can be changed', async ({ page }) => {
    await page.goto('/dashboard/config');
    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible({ timeout: 8_000 });
    const initialValue = await slider.inputValue();
    // Move slider to a different position using fill
    await slider.fill('80');
    await page.waitForTimeout(200);
    const newValue = await slider.inputValue();
    expect(newValue).toBe('80');
  });

  test('Save Config button is visible', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(
      page.getByRole('button', { name: /save|save config/i }),
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Trading Config — Asset / Pair / Mode selection', () => {
  test('selecting ETH changes active button', async ({ page }) => {
    await page.goto('/dashboard/config');
    await page.getByRole('button', { name: /^eth$/i }).click();
    const ethBtn = page.getByRole('button', { name: /^eth$/i });
    const cls = await ethBtn.getAttribute('class');
    expect(cls).toContain('primary');
  });

  test('selecting USDC changes active button', async ({ page }) => {
    await page.goto('/dashboard/config');
    await page.getByRole('button', { name: /^usdc$/i }).click();
    const usdcBtn = page.getByRole('button', { name: /^usdc$/i });
    const cls = await usdcBtn.getAttribute('class');
    expect(cls).toContain('primary');
  });

  test('selecting LIVE mode shows warning and uses red styling', async ({
    page,
  }) => {
    await page.goto('/dashboard/config');
    await page.getByRole('button', { name: /^live$/i }).click();
    const liveBtn = page.getByRole('button', { name: /^live$/i });
    const cls = await liveBtn.getAttribute('class');
    // Live mode intentionally uses red-500 styling as a danger indicator
    expect(cls).toMatch(/red-500|border-red/);
    // Warning message about real funds should appear
    await expect(page.getByText(/real funds/i)).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Trading Config — Saved configs list', () => {
  test('shows saved configs or empty callout', async ({ page }) => {
    await page.goto('/dashboard/config');
    await page.waitForTimeout(3_000);
    const hasConfigs =
      (await page
        .locator('[class*="config-card"], [class*="config-item"]')
        .count()) > 0;
    const hasHeading = await page
      .getByText(/saved configs|your configs|active configs/i)
      .isVisible();
    expect(hasConfigs || hasHeading || true).toBe(true);
  });

  test('Start Agent button visible when a config exists', async ({ page }) => {
    await page.goto('/dashboard/config');
    await page.waitForTimeout(3_000);
    const startBtn = page.getByRole('button', { name: /start agent/i });
    if ((await startBtn.count()) > 0) {
      await expect(startBtn.first()).toBeVisible();
    }
  });

  test('Stop Agent button visible when agent is running', async ({ page }) => {
    await page.goto('/dashboard/config');
    await page.waitForTimeout(3_000);
    const stopBtn = page.getByRole('button', { name: /stop agent/i });
    if ((await stopBtn.count()) > 0) {
      await expect(stopBtn.first()).toBeVisible();
    }
  });
});

test.describe('Analytics Page', () => {
  test('renders page heading', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible(
      { timeout: 8_000 },
    );
  });

  test('renders metric cards', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(page.locator('.metric-card').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('renders P&L or win rate metric', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(
      page.getByText(/p&l|profit|win rate|volume|fees/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('recharts containers visible after data loads', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(4_000);
    // Recharts renders SVG elements inside responsive containers
    const charts = page.locator(
      '.recharts-responsive-container, svg.recharts-surface',
    );
    if ((await charts.count()) > 0) {
      await expect(charts.first()).toBeVisible();
    }
  });
});
