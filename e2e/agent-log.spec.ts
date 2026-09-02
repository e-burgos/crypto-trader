import { test, expect, Page } from '@playwright/test';

const LOADING_SKELETON = '.animate-pulse.rounded-xl.bg-muted';

async function gotoAgentLog(page: Page) {
  await page.goto('/dashboard/agent-log');
  await expect(page.locator('h1').filter({ hasText: /agent log/i })).toBeVisible(
    { timeout: 15_000 },
  );
  await expect(page.locator(LOADING_SKELETON)).toHaveCount(0, {
    timeout: 20_000,
  });
}

test.describe('Agent Log — render', () => {
  test('heading is visible', async ({ page }) => {
    await page.goto('/dashboard/agent-log');
    await expect(
      page.locator('h1').filter({ hasText: /agent log/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows empty state or decision cards', async ({ page }) => {
    await gotoAgentLog(page);
    const cards = await page.locator('.decision-card').count();
    const emptyState = await page
      .getByRole('heading', { name: /no .*decisions/i })
      .count();
    expect(cards > 0 || emptyState > 0).toBe(true);
  });

  test('loading skeletons resolve after data loads', async ({ page }) => {
    await gotoAgentLog(page);
    await expect(page.locator(LOADING_SKELETON)).toHaveCount(0);
  });
});

test.describe('Agent Log — decision cards', () => {
  test('decision card shows action type badge', async ({ page }) => {
    await gotoAgentLog(page);
    const cards = page.locator('.decision-card');
    if ((await cards.count()) > 0) {
      await expect(cards.first()).toBeVisible();
      await expect(
        cards.first().getByText(/buy|sell|hold|close/i).first(),
      ).toBeVisible();
    }
  });

  test('decision card confidence bar renders', async ({ page }) => {
    await gotoAgentLog(page);
    const cards = page.locator('.decision-card');
    if ((await cards.count()) > 0) {
      await expect(
        cards.first().locator('[class*="bg-primary"]').first(),
      ).toBeVisible();
    }
  });
});
