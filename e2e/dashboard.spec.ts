import { test, expect } from '@playwright/test';

test.describe('Dashboard — Overview', () => {
  test('shows sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard');
    // Sidebar nav items
    await expect(page.getByRole('link', { name: /overview|dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /chart|live/i }).first()).toBeVisible();
  });

  test('overview page renders stat cards', async ({ page }) => {
    await page.goto('/dashboard');
    // At least one stat card or metric should be visible
    await expect(
      page.locator('.stat-card, [data-testid="stat-card"], .rounded-xl').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Dashboard — Live Chart', () => {
  test('renders chart container', async ({ page }) => {
    await page.goto('/dashboard/chart');
    // Chart library renders a canvas or div
    await expect(
      page.locator('canvas, [class*="chart"], [class*="Chart"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Dashboard — Trade History', () => {
  test('renders filter tabs', async ({ page }) => {
    await page.goto('/dashboard/history');
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /buy/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sell/i })).toBeVisible();
  });
});

test.describe('Dashboard — Settings', () => {
  test('renders Binance key form', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByText(/binance/i)).toBeVisible();
    await expect(page.getByLabel(/api key/i).first()).toBeVisible();
  });

  test('renders LLM key form', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByText(/ai model|llm/i)).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();
  });
});
