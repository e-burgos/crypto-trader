import { test, expect } from '@playwright/test';
import {
  BINANCE_UNREACHABLE_REASON,
  isBinancePublicApiReachable,
} from './helpers/binance-public-api';

test.describe('Dashboard — Overview', () => {
  test('shows sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.getByLabel('Navigation', { exact: true });
    await expect(
      sidebar.getByRole('link', { name: 'Overview', exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole('link', { name: 'Market', exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole('link', { name: 'Agent Log', exact: true }),
    ).toBeVisible();
  });

  test('overview page renders stat cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(
      page
        .locator('.stat-card, [data-testid="stat-card"], .rounded-xl')
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Dashboard — Market', () => {
  test('/dashboard/chart redirects to the Market page', async ({ page }) => {
    await page.goto('/dashboard/chart');
    await expect(page).toHaveURL(/\/dashboard\/market$/);
    await expect(
      page.locator('h1').filter({ hasText: /market/i }),
    ).toBeVisible();
  });

  test('renders chart container', async ({ page }) => {
    test.skip(
      !(await isBinancePublicApiReachable()),
      BINANCE_UNREACHABLE_REASON,
    );
    await page.goto('/dashboard/market');
    await expect(page.locator('canvas').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('Dashboard — Trade History', () => {
  test('renders the All / Buys / Sells filter tabs', async ({ page }) => {
    await page.goto('/dashboard/history');
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^buys$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^sells$/i })).toBeVisible();
  });

  test('trading mode is chosen globally, not with per-page LIVE/PAPER tabs', async ({
    page,
  }) => {
    await page.goto('/dashboard/history');
    await expect(
      page.getByRole('button', { name: 'Operation mode' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^paper$/i })).toHaveCount(0);
  });

  test('clicking Buys marks that tab as the active one', async ({ page }) => {
    await page.goto('/dashboard/history');
    const buys = page.getByRole('button', { name: /^buys$/i });
    const all = page.getByRole('button', { name: /^all$/i });
    await expect(all).toHaveClass(/bg-background/);
    await buys.click();
    await expect(buys).toHaveClass(/bg-background/);
    await expect(all).not.toHaveClass(/bg-background/);
  });

  test('clicking Sells marks that tab as the active one', async ({ page }) => {
    await page.goto('/dashboard/history');
    const sells = page.getByRole('button', { name: /^sells$/i });
    await sells.click();
    await expect(sells).toHaveClass(/bg-background/);
    await expect(page.getByRole('button', { name: /^all$/i })).not.toHaveClass(
      /bg-background/,
    );
  });

  test('shows trades table or empty state', async ({ page }) => {
    await page.goto('/dashboard/history');
    await expect(page.getByText(/\d+ trades/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('Dashboard — Market chart controls', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !(await isBinancePublicApiReachable()),
      BINANCE_UNREACHABLE_REASON,
    );
    await page.goto('/dashboard/market');
  });

  test('pair tabs for BTC and ETH are visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'BTC / USDT', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: 'ETH / USDT', exact: true }),
    ).toBeVisible();
  });

  test('interval buttons (1m, 1h, 1d) are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: '1m', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('button', { name: '1h', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '1d', exact: true }),
    ).toBeVisible();
  });

  test('switching to ETH keeps the chart rendered', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 20_000 });
    await page.getByRole('button', { name: 'ETH / USDT', exact: true }).click();
    await expect(page.locator('canvas').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('switching interval to 5m keeps the chart rendered', async ({
    page,
  }) => {
    await page.waitForSelector('canvas', { timeout: 20_000 });
    await page.getByRole('button', { name: '5m', exact: true }).click();
    await expect(page.locator('canvas').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('Dashboard — Settings', () => {
  test('/dashboard/settings redirects to the Profile tab', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/\/dashboard\/settings\/profile$/);
    await expect(
      page.getByRole('heading', { name: 'Profile', exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Profile tab shows the account email field', async ({ page }) => {
    await page.goto('/dashboard/settings/profile');
    await expect(page.getByText('Email', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole('button', { name: /save/i }).first(),
    ).toBeVisible();
  });

  test('Exchange tab renders the Binance API key and secret inputs', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings/exchange');
    await expect(
      page.locator('h1').filter({ hasText: /exchange/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder('Your Binance API Key'),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder('Your Binance API Secret'),
    ).toBeVisible();
  });

  test('can type into the Binance API Key field', async ({ page }) => {
    await page.goto('/dashboard/settings/exchange');
    const input = page.getByPlaceholder('Your Binance API Key');
    await input.fill('test-api-key-value');
    await expect(input).toHaveValue('test-api-key-value');
  });

  test('LLMs tab lists the secondary providers under "Other Providers"', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings/llms');
    await expect(page.locator('h1').filter({ hasText: /llms/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Other Providers' }).click();
    await expect(page.getByText('Anthropic Claude').first()).toBeVisible();
    await expect(
      page.getByText('OpenAI', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('Groq', { exact: true }).first()).toBeVisible();
  });
});
