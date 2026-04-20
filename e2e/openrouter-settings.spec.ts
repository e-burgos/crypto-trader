/**
 * Spec 35 — OpenRouter Integration E2E Tests
 *
 * Covers: Primary Provider tab visibility, 3-tab navigation in AI settings,
 * OpenRouter card UI, providers grid filtering.
 *
 * Uses admin@crypto.com (has known working password).
 */
import { test, expect, type Page } from '@playwright/test';

const USER_EMAIL = 'admin@crypto.com';
const USER_PASSWORD = 'Admin1234!';

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: 'serial' });

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill(USER_EMAIL);
  await page.getByPlaceholder(/password|contraseña/i).fill(USER_PASSWORD);
  await page.getByRole('button', { name: /sign in|iniciar sesión/i }).click();
  await page.waitForURL(/\/(dashboard|home)/);
}

async function goToAISettings(page: Page) {
  await page.goto('/dashboard/settings');
  // Click AI tab
  const aiTab = page.locator('button').filter({ hasText: /ai|ia/i }).first();
  await aiTab.click();
  await expect(aiTab).toHaveClass(/bg-background|text-foreground/);
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

  test('AI settings shows 3 sub-tabs', async () => {
    await goToAISettings(page);
    // Should see Primary Provider, Other Providers, Analytics
    await expect(
      page
        .locator('button')
        .filter({ hasText: /primary provider|proveedor principal/i }),
    ).toBeVisible();
    await expect(
      page
        .locator('button')
        .filter({ hasText: /other providers|otros proveedores/i }),
    ).toBeVisible();
    await expect(
      page.locator('button').filter({ hasText: /analytics|analíticas/i }),
    ).toBeVisible();
  });

  test('Primary Provider tab shows OpenRouter card with recommended badge', async () => {
    // Primary tab should be active by default
    const card = page.locator('text=OpenRouter').first();
    await expect(card).toBeVisible();
    await expect(
      page.locator('text=/recommended|recomendado/i').first(),
    ).toBeVisible();
  });

  test('Primary Provider tab has API key input and benefits', async () => {
    await expect(page.getByPlaceholder('sk-or-v1-...')).toBeVisible();
    // Check at least one benefit is visible
    await expect(
      page.locator('text=/200\\+ models|\\+200 modelos/i').first(),
    ).toBeVisible();
  });

  test('Other Providers tab shows provider grid without OpenRouter', async () => {
    await page
      .locator('button')
      .filter({ hasText: /other providers|otros proveedores/i })
      .click();

    // Grid should show Claude, OpenAI, etc.
    await expect(page.locator('text=Anthropic Claude').first()).toBeVisible();
    await expect(page.locator('text=OpenAI').first()).toBeVisible();

    // Should NOT have an OpenRouter card in the grid
    const gridCards = page.locator('.grid .rounded-xl');
    const count = await gridCards.count();
    for (let i = 0; i < count; i++) {
      const text = await gridCards.nth(i).textContent();
      expect(text).not.toContain('OpenRouter');
    }

    // Should show the banner suggesting OpenRouter
    await expect(
      page.locator('text=/with openrouter|con openrouter/i').first(),
    ).toBeVisible();
  });

  test('Analytics tab still works', async () => {
    await page
      .locator('button')
      .filter({ hasText: /analytics|analíticas/i })
      .click();

    // Should show provider status or usage dashboard content
    await page.waitForTimeout(500);
    // The analytics section renders ProviderStatusGrid or AIUsageDashboard
    const content = page.locator('.space-y-6');
    await expect(content.first()).toBeVisible();
  });
});
