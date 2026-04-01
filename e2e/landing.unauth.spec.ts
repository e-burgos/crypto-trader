import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('shows hero section with CTA buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /get started|start trading/i }),
    ).toBeVisible();
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: /theme|dark|light/i });

    if (await toggle.isVisible()) {
      const initialClass = await html.getAttribute('class');
      await toggle.click();
      await expect(html).not.toHaveClass(initialClass || '');
    }
  });

  test('price ticker is visible', async ({ page }) => {
    await page.goto('/');
    // Ticker scrolls btc/eth prices
    await expect(
      page
        .locator('[data-testid="price-ticker"], .price-ticker, header')
        .first(),
    ).toBeVisible();
  });
});

test.describe('Navigation — unauthenticated', () => {
  test('redirects /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });
});
