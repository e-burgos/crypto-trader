import { test, expect } from '@playwright/test';

test.describe('Trading Config — CRUD', () => {
  test('config page renders form', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(page.getByText(/trading agent|configuration/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create|add|save/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('can open config creation form', async ({ page }) => {
    await page.goto('/dashboard/config');
    // Try to find a create/add button
    const addBtn = page.getByRole('button', { name: /new config|create|add/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      // Some form element should appear
      await expect(page.getByLabel(/symbol|pair/i).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Analytics Page', () => {
  test('renders performance metrics', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    // P&L or win rate metric should be visible
    await expect(
      page.getByText(/p&l|profit|win rate|volume|fees/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
