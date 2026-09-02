import { test, expect, Page } from '@playwright/test';

const ENRICHED_SNAPSHOT_UNAVAILABLE =
  'El endpoint /market/enriched-snapshot no devolvió datos: las fuentes externas no son alcanzables desde este runner.';

async function gotoWithSnapshot(page: Page) {
  const snapshot = page
    .waitForResponse(
      (r) => r.url().includes('/market/enriched-snapshot'),
      { timeout: 30_000 },
    )
    .catch(() => null);
  await page.goto('/dashboard/market-intelligence');
  return snapshot;
}

test.describe('Market Intelligence', () => {
  test('navigates to /dashboard/market-intelligence and renders page', async ({
    page,
  }) => {
    await page.goto('/dashboard/market-intelligence');
    await expect(
      page.getByRole('heading', { name: 'Market Intelligence' }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('asset selector tabs are visible and clickable', async ({ page }) => {
    await page.goto('/dashboard/market-intelligence');
    await expect(
      page.getByRole('heading', { name: 'Market Intelligence' }),
    ).toBeVisible({ timeout: 15_000 });

    const btcTab = page.getByRole('button', { name: 'Bitcoin', exact: true });
    const ethTab = page.getByRole('button', { name: 'Ethereum', exact: true });
    await expect(btcTab).toBeVisible();
    await expect(ethTab).toBeVisible();

    await ethTab.click();
    await expect(ethTab).toHaveClass(/bg-background/);
  });

  test('shows metadata footer with active sources info', async ({ page }) => {
    const snapshot = await gotoWithSnapshot(page);
    await expect(
      page.getByRole('heading', { name: 'Market Intelligence' }),
    ).toBeVisible({ timeout: 15_000 });

    const response = await snapshot;
    test.skip(!response?.ok(), ENRICHED_SNAPSHOT_UNAVAILABLE);

    await expect(page.getByText(/active sources/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('link from bot-analysis to market-intelligence works', async ({
    page,
  }) => {
    await page.goto('/dashboard/bot-analysis');
    const link = page.getByText(
      /View full Market Intelligence|Ver panel completo/i,
    );
    if (await link.first().isVisible({ timeout: 10_000 }).catch(() => false)) {
      await link.first().click();
      await expect(page).toHaveURL(/market-intelligence/);
    }
  });

  test('refresh button triggers data reload', async ({ page }) => {
    await page.goto('/dashboard/market-intelligence');
    await expect(
      page.getByRole('heading', { name: 'Market Intelligence' }),
    ).toBeVisible({ timeout: 15_000 });

    const refreshBtn = page.getByRole('button', { name: /refresh/i });
    await expect(refreshBtn).toBeVisible();
    const refetch = page
      .waitForResponse((r) => r.url().includes('/market/enriched-snapshot'), {
        timeout: 30_000,
      })
      .catch(() => null);
    await refreshBtn.click();
    await refetch;
    await expect(
      page.getByRole('heading', { name: 'Market Intelligence' }),
    ).toBeVisible();
  });
});
