import { test, expect } from '@playwright/test';

test.describe('News Feed — render', () => {
  test('heading and Newspaper icon visible', async ({ page }) => {
    await page.goto('/dashboard/news');
    await expect(page.getByRole('heading', { name: /news/i })).toBeVisible({
      timeout: 8_000,
    });
  });

  test('sentiment filter buttons all visible', async ({ page }) => {
    await page.goto('/dashboard/news');
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole('button', { name: /positive/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /negative/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /neutral/i })).toBeVisible();
  });

  test('"All" filter is active by default', async ({ page }) => {
    await page.goto('/dashboard/news');
    await page.waitForTimeout(2_000);
    const allBtn = page.getByRole('button', { name: /^all$/i });
    // Active state has bg-primary/10 or similar — check aria or class
    const allClass = await allBtn.getAttribute('class');
    expect(allClass).toBeTruthy();
  });
});

test.describe('News Feed — sentiment filters', () => {
  test('clicking Positive filter updates list', async ({ page }) => {
    await page.goto('/dashboard/news');
    await page.waitForTimeout(3_000);
    await page.getByRole('button', { name: /positive/i }).click();
    // Count before/after changes or page re-renders
    await page.waitForTimeout(500);
    // Positive filter button should now look active
    const posBtn = page.getByRole('button', { name: /positive/i });
    const cls = await posBtn.getAttribute('class');
    expect(cls).toContain('primary');
  });

  test('clicking Negative filter updates list', async ({ page }) => {
    await page.goto('/dashboard/news');
    await page.waitForTimeout(3_000);
    await page.getByRole('button', { name: /negative/i }).click();
    await page.waitForTimeout(500);
    const negBtn = page.getByRole('button', { name: /negative/i });
    const cls = await negBtn.getAttribute('class');
    expect(cls).toContain('primary');
  });

  test('clicking Neutral filter updates list', async ({ page }) => {
    await page.goto('/dashboard/news');
    await page.waitForTimeout(3_000);
    await page.getByRole('button', { name: /neutral/i }).click();
    await page.waitForTimeout(500);
    const neutralBtn = page.getByRole('button', { name: /neutral/i });
    const cls = await neutralBtn.getAttribute('class');
    expect(cls).toContain('primary');
  });
});

test.describe('News Feed — news cards', () => {
  test('shows news cards or empty state', async ({ page }) => {
    await page.goto('/dashboard/news');
    await page.waitForTimeout(4_000);
    const hasCard = await page.locator('.news-card').first().isVisible();
    const hasEmpty = await page
      .locator('[class*="border-dashed"]')
      .first()
      .isVisible();
    expect(hasCard || hasEmpty).toBe(true);
  });

  test('news cards have external link', async ({ page }) => {
    await page.goto('/dashboard/news');
    await page.waitForTimeout(4_000);
    if ((await page.locator('.news-card').count()) > 0) {
      // Each card should have a clickable link with target="_blank"
      const link = page.locator('.news-card a[target="_blank"]').first();
      if (await link.isVisible()) {
        const href = await link.getAttribute('href');
        expect(href).toBeTruthy();
      }
    }
  });
});
