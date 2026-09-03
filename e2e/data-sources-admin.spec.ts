import { test, expect } from '@playwright/test';

/**
 * E2E: Admin Data Sources management
 * Uses admin auth state (e2e/.auth/admin.json)
 */
// Card now forwards data-testid to its root div (FIX-e-burgos-021); the page's
// own .ds-card wrapper stays as a fallback selector.
const SOURCE_CARD = '[data-testid="data-source-card"], .ds-card';

test.describe('Admin — Data Sources', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('navigates to /admin/data-sources and sees source list', async ({
    page,
  }) => {
    await page.goto('/admin/data-sources');
    await expect(
      page.getByRole('heading', { name: 'Market Data Sources' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator(SOURCE_CARD).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('can toggle a data source off and on', async ({ page }) => {
    await page.goto('/admin/data-sources');
    const firstCard = page.locator(SOURCE_CARD).first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    const toggle = firstCard.getByRole('switch');
    const initial = await toggle.getAttribute('aria-checked');
    await toggle.click();
    await expect(toggle).not.toHaveAttribute('aria-checked', initial ?? '', {
      timeout: 10_000,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', initial ?? '', {
      timeout: 10_000,
    });
  });

  test('health check button works', async ({ page }) => {
    await page.goto('/admin/data-sources');
    await expect(
      page.locator(SOURCE_CARD).first(),
    ).toBeVisible({ timeout: 15_000 });

    const healthBtn = page.getByRole('button', { name: /health check all/i });
    await expect(healthBtn).toBeVisible();
    await healthBtn.click();
    await expect(healthBtn).toBeEnabled({ timeout: 60_000 });
  });

  test('summary bar displays the active-sources metric', async ({ page }) => {
    await page.goto('/admin/data-sources');
    await expect(
      page.getByRole('heading', { name: 'Market Data Sources' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\d+\/\d+ active/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
