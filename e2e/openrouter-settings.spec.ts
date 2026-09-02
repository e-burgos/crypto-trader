/**
 * Spec 35 — OpenRouter Integration E2E Tests
 *
 * Covers: Primary Provider tab visibility, 3-tab navigation in the LLMs settings,
 * OpenRouter card UI, providers grid filtering.
 *
 * Uses trader@crypto.com — /dashboard/* is restricted to the TRADER role.
 */
import { test, expect, type Page } from '@playwright/test';

const USER_EMAIL = 'trader@crypto.com';
const USER_PASSWORD = 'Trader1234!';

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: 'serial' });

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(USER_EMAIL);
  await page.locator('input[type="password"]').fill(USER_PASSWORD);
  await page
    .getByRole('main')
    .getByRole('button', { name: /sign in/i })
    .click();
  await page.waitForURL('**/dashboard**', { timeout: 15_000 });
}

async function goToLlmSettings(page: Page) {
  await page.goto('/dashboard/settings/llms');
  await expect(page.locator('h1').filter({ hasText: /llms/i })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('OpenRouter Settings — 3-Tab Layout', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('LLM settings shows 3 sub-tabs', async () => {
    await goToLlmSettings(page);
    await expect(
      page.getByRole('button', { name: 'Primary Provider' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Other Providers' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Provider Analytics' }),
    ).toBeVisible();
  });

  test('Primary Provider tab shows OpenRouter card with recommended badge', async () => {
    await expect(page.getByText('OpenRouter').first()).toBeVisible();
    await expect(page.getByText('Recommended').first()).toBeVisible();
  });

  test('Primary Provider tab has API key input and benefits', async () => {
    await expect(page.getByPlaceholder('sk-or-v1-...')).toBeVisible();
    await expect(
      page.getByText('200+ models from all major providers'),
    ).toBeVisible();
  });

  test('Other Providers tab shows provider grid without OpenRouter', async () => {
    await page.getByRole('button', { name: 'Other Providers' }).click();

    await expect(page.getByText('Anthropic Claude').first()).toBeVisible();
    await expect(
      page.getByText('OpenAI', { exact: true }).first(),
    ).toBeVisible();

    const gridCards = page.locator('.grid .rounded-xl');
    const count = await gridCards.count();
    for (let i = 0; i < count; i++) {
      expect(await gridCards.nth(i).textContent()).not.toContain('OpenRouter');
    }

    await expect(
      page.getByText(
        'With OpenRouter you can access all these providers with a single API key.',
      ),
    ).toBeVisible();
  });

  test('Provider Analytics tab still works', async () => {
    await page.getByRole('button', { name: 'Provider Analytics' }).click();
    await expect(
      page.getByRole('button', { name: 'Provider Analytics' }),
    ).toHaveClass(/bg-card/);
  });
});
