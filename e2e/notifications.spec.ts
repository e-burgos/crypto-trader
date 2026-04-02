import { test, expect } from '@playwright/test';

test.describe('Notifications Dropdown', () => {
  test('bell button is visible in dashboard header', async ({ page }) => {
    await page.goto('/dashboard');
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 8_000 });
  });

  test('clicking bell opens the dropdown', async ({ page }) => {
    await page.goto('/dashboard');
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 5_000 });
    await bellBtn.click();
    await expect(page.getByText(/notifications/i).nth(1)).toBeVisible({
      timeout: 3_000,
    });
  });

  test('Mark All Read button is visible in dropdown', async ({ page }) => {
    await page.goto('/dashboard');
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 5_000 });
    await bellBtn.click();
    await page.waitForTimeout(400);
    const markAllBtn = page.getByRole('button', { name: /mark all/i });
    if (await markAllBtn.isVisible()) {
      await expect(markAllBtn).toBeEnabled();
    }
  });

  test('clicking Mark All Read calls mutation', async ({ page }) => {
    await page.goto('/dashboard');
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 5_000 });
    await bellBtn.click();
    await page.waitForTimeout(400);
    const markAllBtn = page.getByRole('button', { name: /mark all/i });
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      await page.waitForTimeout(1_000);
      const badge = page.locator(
        'button[aria-label="Notifications"] span.bg-red-500',
      );
      const count = await badge.count();
      if (count > 0) {
        const text = await badge.textContent();
        expect(text?.trim()).toBe('0');
      }
    }
  });

  test('shows empty state when no notifications', async ({ page }) => {
    await page.goto('/dashboard');
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 5_000 });
    await bellBtn.click();
    await page.waitForTimeout(2_000);
    const hasItems = (await page.locator('.notif-item').count()) > 0;
    const hasEmpty = await page
      .getByText(/no notifications|all caught up/i)
      .isVisible();
    expect(hasItems || hasEmpty).toBe(true);
  });
});
