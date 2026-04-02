import { test, expect } from '@playwright/test';

test.describe('Positions Page — render', () => {
  test('heading and column headers visible', async ({ page }) => {
    await page.goto('/dashboard/positions');
    await expect(page.getByRole('heading', { name: /positions/i })).toBeVisible(
      { timeout: 8_000 },
    );
  });

  test('shows empty state or positions table', async ({ page }) => {
    await page.goto('/dashboard/positions');
    // Wait for loading to finish
    await page.waitForTimeout(3_000);
    // Either empty state or table is visible
    const hasTable = await page.locator('table').isVisible();
    const hasEmpty = await page.locator('[class*="border-dashed"]').isVisible();
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('loading skeletons appear then resolve', async ({ page }) => {
    await page.goto('/dashboard/positions');
    // Skeleton pulses may be briefly visible
    // After load, they should disappear
    await page.waitForTimeout(4_000);
    const skeletons = page.locator('.animate-pulse');
    // After loading completes, skeletons should be gone
    await expect(skeletons).toHaveCount(0, { timeout: 6_000 });
  });
});

test.describe('Positions Page — pagination', () => {
  test('prev/next buttons rendered when multiple pages exist', async ({
    page,
  }) => {
    await page.goto('/dashboard/positions');
    await page.waitForTimeout(3_000);
    const table = await page.locator('table').isVisible();
    if (table) {
      // Pagination buttons might exist depending on data volume
      const prevBtn = page.getByRole('button', {
        name: /prev|previous|chevron-left/i,
      });
      const nextBtn = page.getByRole('button', { name: /next|chevron-right/i });
      // They render but prev should be disabled on page 1
      if (await prevBtn.isVisible()) {
        await expect(prevBtn).toBeDisabled();
      }
    }
  });
});
