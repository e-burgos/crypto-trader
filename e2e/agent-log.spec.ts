import { test, expect } from '@playwright/test';

test.describe('Agent Log — render', () => {
  test('heading is visible', async ({ page }) => {
    await page.goto('/dashboard/agent');
    // Use direct h1 selector to avoid ambiguity with role query
    await expect(
      page.locator('h1').filter({ hasText: /agent log/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows empty state or decision cards', async ({ page }) => {
    await page.goto('/dashboard/agent');
    await page.waitForTimeout(3_000);
    const hasCards = await page.locator('.decision-card').first().isVisible();
    const hasEmpty = await page
      .locator('[class*="border-dashed"]')
      .first()
      .isVisible();
    expect(hasCards || hasEmpty).toBe(true);
  });

  test('loading skeletons resolve after data loads', async ({ page }) => {
    await page.goto('/dashboard/agent');
    await page.waitForTimeout(4_000);
    const skeletons = page.locator('.animate-pulse');
    await expect(skeletons).toHaveCount(0, { timeout: 6_000 });
  });
});

test.describe('Agent Log — decision cards', () => {
  test('decision card shows action type badge', async ({ page }) => {
    await page.goto('/dashboard/agent');
    await page.waitForTimeout(3_000);
    const cards = page.locator('.decision-card');
    if ((await cards.count()) > 0) {
      await expect(cards.first()).toBeVisible();
      // BUY / SELL / HOLD badge
      await expect(
        cards.first().getByText(/buy|sell|hold|close/i),
      ).toBeVisible();
    }
  });

  test('decision card confidence bar renders', async ({ page }) => {
    await page.goto('/dashboard/agent');
    await page.waitForTimeout(3_000);
    if ((await page.locator('.decision-card').count()) > 0) {
      // Confidence bar is a div with class bg-primary
      await expect(
        page.locator('.decision-card').first().locator('[class*="bg-primary"]'),
      ).toBeVisible();
    }
  });
});
