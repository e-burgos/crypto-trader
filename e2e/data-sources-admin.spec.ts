import { test, expect } from '@playwright/test';

/**
 * E2E: Admin Data Sources management
 * Uses admin auth state (e2e/.auth/admin.json)
 */
test.describe('Admin — Data Sources', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('navigates to /admin/data-sources and sees source list', async ({
    page,
  }) => {
    await page.goto('/admin/data-sources');
    await expect(page.getByText(/Data Sources|Fuentes de Datos/i)).toBeVisible({
      timeout: 8_000,
    });
    // At least one source should be listed
    await expect(
      page.locator('[data-testid="data-source-card"]').first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('can toggle a data source off and on', async ({ page }) => {
    await page.goto('/admin/data-sources');
    await expect(
      page.locator('[data-testid="data-source-card"]').first(),
    ).toBeVisible({ timeout: 8_000 });

    // Find the first toggle button
    const firstCard = page.locator('[data-testid="data-source-card"]').first();
    const toggle = firstCard.locator(
      'button[aria-label*="toggle"], [data-testid="toggle-source"]',
    );

    if (await toggle.isVisible()) {
      await toggle.click();
      // Wait for status change feedback
      await page.waitForTimeout(1_000);
      // Toggle back
      await toggle.click();
      await page.waitForTimeout(1_000);
    }
  });

  test('health check button works', async ({ page }) => {
    await page.goto('/admin/data-sources');
    await expect(
      page.locator('[data-testid="data-source-card"]').first(),
    ).toBeVisible({ timeout: 8_000 });

    const healthBtn = page
      .getByRole('button', { name: /health|check|verificar/i })
      .first();

    if (await healthBtn.isVisible()) {
      await healthBtn.click();
      // Should show some feedback (toast or status change)
      await page.waitForTimeout(2_000);
    }
  });

  test('stats section displays metrics', async ({ page }) => {
    await page.goto('/admin/data-sources');
    await expect(page.getByText(/Data Sources|Fuentes de Datos/i)).toBeVisible({
      timeout: 8_000,
    });

    // Check for stats section elements
    const statsText = page.getByText(/active|activas|total|circuit|rate/i);
    await expect(statsText.first()).toBeVisible({ timeout: 5_000 });
  });
});
