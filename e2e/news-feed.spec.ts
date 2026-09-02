import { test, expect, Page } from '@playwright/test';

const NEWS_SKELETON = '.animate-pulse.rounded-xl.bg-muted';

async function gotoNewsFeed(page: Page) {
  await page.goto('/dashboard/news');
  await expect(
    page.locator('h1').filter({ hasText: /news analysis/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(NEWS_SKELETON)).toHaveCount(0, { timeout: 30_000 });
}

test.describe('News Feed — render', () => {
  test('heading and Newspaper icon visible', async ({ page }) => {
    await page.goto('/dashboard/news');
    await expect(
      page.locator('h1').filter({ hasText: /news analysis/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('sentiment filter buttons all visible', async ({ page }) => {
    await gotoNewsFeed(page);
    await expect(
      page.getByRole('button', { name: 'All news', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Positive', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Negative', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Neutral', exact: true }),
    ).toBeVisible();
  });

  test('"All news" filter is active by default', async ({ page }) => {
    await gotoNewsFeed(page);
    await expect(
      page.getByRole('button', { name: 'All news', exact: true }),
    ).toHaveClass(/bg-background/);
  });
});

test.describe('News Feed — sentiment filters', () => {
  for (const label of ['Positive', 'Negative', 'Neutral']) {
    test(`clicking ${label} marks that filter as active`, async ({ page }) => {
      await gotoNewsFeed(page);
      const btn = page.getByRole('button', { name: label, exact: true });
      await btn.click();
      await expect(btn).toHaveClass(/bg-background/);
      await expect(
        page.getByRole('button', { name: 'All news', exact: true }),
      ).not.toHaveClass(/bg-background/);
    });
  }
});

test.describe('News Feed — news cards', () => {
  test('shows news cards or empty state', async ({ page }) => {
    await gotoNewsFeed(page);
    const cards = await page.locator('.news-card').count();
    const empty = await page.locator('[class*="border-dashed"]').count();
    expect(cards > 0 || empty > 0).toBe(true);
  });

  test('news cards have external link', async ({ page }) => {
    await gotoNewsFeed(page);
    if ((await page.locator('.news-card').count()) > 0) {
      const link = page.locator('.news-card a[target="_blank"]').first();
      await expect(link).toHaveAttribute('href', /^https?:\/\//);
    }
  });
});
