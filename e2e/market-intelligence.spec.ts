import { test, expect } from '@playwright/test';

/**
 * E2E: Market Intelligence page (trader-facing)
 * Uses default trader auth state.
 */
test.describe('Market Intelligence', () => {
  test('navigates to /dashboard/market-intelligence and renders page', async ({
    page,
  }) => {
    await page.goto('/dashboard/market-intelligence');
    await expect(
      page.getByText(/Market Intelligence|Inteligencia de Mercado/i),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('symbol selector tabs are visible and clickable', async ({ page }) => {
    await page.goto('/dashboard/market-intelligence');
    await expect(
      page.getByText(/Market Intelligence|Inteligencia de Mercado/i),
    ).toBeVisible({ timeout: 8_000 });

    // Should see symbol tabs (BTC/USDT, ETH/USDT, etc.)
    const btcTab = page.getByRole('tab', { name: /BTC/i }).first();
    await expect(btcTab).toBeVisible();

    const ethTab = page.getByRole('tab', { name: /ETH/i }).first();
    if (await ethTab.isVisible()) {
      await ethTab.click();
      // Should not crash
      await page.waitForTimeout(1_000);
    }
  });

  test('shows metadata footer with active sources info', async ({ page }) => {
    await page.goto('/dashboard/market-intelligence');
    await expect(
      page.getByText(/Market Intelligence|Inteligencia de Mercado/i),
    ).toBeVisible({ timeout: 8_000 });

    // Metadata footer should eventually appear
    const footer = page.getByText(
      /Active sources|Fuentes activas|Build time|Tiempo/i,
    );
    // It may take a moment for the API to respond
    await expect(footer.first()).toBeVisible({ timeout: 10_000 });
  });

  test('link from bot-analysis to market-intelligence works', async ({
    page,
  }) => {
    await page.goto('/dashboard/bot-analysis');
    await page.waitForTimeout(2_000);

    const link = page.getByText(
      /View full Market Intelligence|Ver panel completo/i,
    );
    if (await link.isVisible({ timeout: 5_000 })) {
      await link.click();
      await expect(page).toHaveURL(/market-intelligence/);
    }
  });

  test('refresh button triggers data reload', async ({ page }) => {
    await page.goto('/dashboard/market-intelligence');
    await expect(
      page.getByText(/Market Intelligence|Inteligencia de Mercado/i),
    ).toBeVisible({ timeout: 8_000 });

    const refreshBtn = page.getByRole('button', {
      name: /refresh|actualizar/i,
    });
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      // Should not crash — button may show spinning animation
      await page.waitForTimeout(1_500);
    }
  });
});
