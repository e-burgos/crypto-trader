/**
 * Spec 31 — LLM Provider Dashboard E2E Tests
 *
 * Covers: provider availability grid (now an admin-only view), the LLM API
 * endpoints, provider models, usage tracking and the trader LLM settings tab.
 *
 * The grid and its cards only render when the user has at least one LLM
 * credential stored. CI seeds no LLM keys, so those tests skip there with a
 * reason instead of failing.
 *
 * Auth comes from the storage states produced by global.setup-admin /
 * global.setup-trader: logging in per test trips the API rate limit
 * (10 logins / 60 s per IP).
 */
import { test, expect, type Page } from '@playwright/test';

const ADMIN_STATE = 'e2e/.auth/admin.json';
const TRADER_STATE = 'e2e/.auth/trader.json';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3000/api';

const NO_LLM_KEYS_REASON =
  'El usuario no tiene credenciales LLM cargadas (CI no siembra claves): la grilla de proveedores no se renderiza.';

async function getToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(token, 'accessToken must be in localStorage').toBeTruthy();
  return token!;
}

async function providerStatuses(page: Page) {
  const token = await getToken(page);
  const res = await page.request.get(
    `${API_BASE}/users/me/llm/providers/status`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(res.status()).toBe(200);
  return (await res.json()) as Array<Record<string, unknown>>;
}

/** The availability grid moved from trader settings to /admin/llm-providers. */
async function goToProviderAvailability(page: Page) {
  await page.goto('/admin/llm-providers');
  await expect(
    page.locator('h1').filter({ hasText: /llm provider management/i }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Provider Availability' }).click();
  await expect(
    page.getByRole('heading', { name: 'LLM Provider Status' }),
  ).toBeVisible({ timeout: 15_000 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Admin > LLM Providers — Provider Availability grid
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('1 — Provider Availability grid (admin UI)', () => {
  test.use({ storageState: ADMIN_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    const statuses = await providerStatuses(page);
    test.skip(statuses.length === 0, NO_LLM_KEYS_REASON);
    await goToProviderAvailability(page);
  });

  test('1.1 "LLM Provider Status" heading is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'LLM Provider Status' }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('1.2 Refresh button is visible and clickable', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshBtn).toBeVisible({ timeout: 15_000 });
    await refreshBtn.click();
    await expect(refreshBtn).toBeEnabled({ timeout: 15_000 });
  });

  test('1.3 At least one provider card renders', async ({ page }) => {
    const providerLabels = [
      'Anthropic (Claude)',
      'OpenAI',
      'Groq',
      'Google Gemini',
      'Mistral AI',
      'Together AI',
      'OpenRouter',
    ];

    let found = 0;
    for (const label of providerLabels) {
      if (await page.getByText(label).first().isVisible().catch(() => false)) {
        found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(1);
  });

  test('1.4 Provider card shows key status badge (ACTIVE)', async ({
    page,
  }) => {
    await expect(page.getByText('ACTIVE').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('1.6 Provider card shows token info (Input/Output)', async ({
    page,
  }) => {
    await expect(page.getByText('Input').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Output').first()).toBeVisible();
  });

  test('1.7 Provider card shows estimated cost', async ({ page }) => {
    await expect(page.getByText(/Est\. Cost/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('1.8 Disclaimer footer is visible', async ({ page }) => {
    await expect(page.getByText(/Costs are estimates/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('1.10 Last success or "Never used" is shown', async ({ page }) => {
    await expect(
      page.getByText(/Last success|Never used/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: API — Provider Status Endpoint
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('2 — API: GET /users/me/llm/providers/status', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('2.1 Returns array of ProviderStatus objects', async ({ page }) => {
    const body = await providerStatuses(page);
    expect(Array.isArray(body)).toBe(true);

    for (const status of body) {
      expect(status).toHaveProperty('provider');
      expect(status).toHaveProperty('availability');
      expect(status).toHaveProperty('availabilityScore');
      expect(status).toHaveProperty('rateLimits');
      expect(status).toHaveProperty('usage');
      expect(status).toHaveProperty('keyStatus');
      expect(['AVAILABLE', 'LIMITED', 'UNAVAILABLE']).toContain(
        status.availability,
      );
      expect(typeof status.availabilityScore).toBe('number');
      expect(status.availabilityScore as number).toBeGreaterThanOrEqual(0);
      expect(status.availabilityScore as number).toBeLessThanOrEqual(100);
      expect(['ACTIVE', 'INACTIVE', 'INVALID']).toContain(status.keyStatus);
    }
  });

  test('2.2 Usage sub-object has correct structure', async ({ page }) => {
    const body = await providerStatuses(page);
    test.skip(body.length === 0, NO_LLM_KEYS_REASON);

    const usage = body[0].usage as Record<string, unknown>;
    expect(usage).toHaveProperty('totalTokensIn');
    expect(usage).toHaveProperty('totalTokensOut');
    expect(usage).toHaveProperty('totalCalls');
    expect(usage).toHaveProperty('estimatedCostUsd');
    expect(Array.isArray(usage.bySource)).toBe(true);
    expect(Array.isArray(usage.dailySeries)).toBe(true);
  });

  test('2.3 Active providers have score >= 70 (AVAILABLE)', async ({
    page,
  }) => {
    const body = await providerStatuses(page);
    test.skip(body.length === 0, NO_LLM_KEYS_REASON);

    for (const status of body) {
      if (status.keyStatus === 'ACTIVE') {
        expect(status.availabilityScore as number).toBeGreaterThanOrEqual(70);
        expect(status.availability).not.toBe('UNAVAILABLE');
      }
    }
  });

  test('2.4 Each provider has lastSuccessAt and lastError fields', async ({
    page,
  }) => {
    const body = await providerStatuses(page);
    test.skip(body.length === 0, NO_LLM_KEYS_REASON);

    for (const s of body) {
      expect(s).toHaveProperty('lastSuccessAt');
      expect(s).toHaveProperty('lastError');
      if (s.lastSuccessAt !== null) {
        expect(typeof s.lastSuccessAt).toBe('string');
      }
    }
  });

  test('2.5 Unauthorized request returns 401', async ({ page }) => {
    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: 'Bearer invalid-token-xyz' } },
    );
    expect(res.status()).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: API — Provider Usage Endpoint
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('3 — API: GET /users/me/llm/providers/:provider/usage', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('3.1 Returns usage data for CLAUDE with correct shape', async ({
    page,
  }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/CLAUDE/usage?period=30d`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('totalTokensIn');
    expect(body).toHaveProperty('totalTokensOut');
    expect(body).toHaveProperty('totalCalls');
    expect(body).toHaveProperty('estimatedCostUsd');
    expect(body).toHaveProperty('bySource');
    expect(body).toHaveProperty('dailySeries');
    expect(typeof body.totalTokensIn).toBe('number');
    expect(typeof body.estimatedCostUsd).toBe('number');
  });

  test('3.2 Supports 7d and 90d periods', async ({ page }) => {
    const token = await getToken(page);

    for (const period of ['7d', '90d']) {
      const res = await page.request.get(
        `${API_BASE}/users/me/llm/providers/GROQ/usage?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.dailySeries)).toBe(true);
    }
  });

  test('3.3 Returns data for all 6 providers (no 500s)', async ({ page }) => {
    const token = await getToken(page);

    const providers = [
      'CLAUDE',
      'OPENAI',
      'GROQ',
      'GEMINI',
      'MISTRAL',
      'TOGETHER',
    ];
    for (const provider of providers) {
      const res = await page.request.get(
        `${API_BASE}/users/me/llm/providers/${provider}/usage?period=30d`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status()).toBe(200);
    }
  });

  test('3.4 bySource entries have correct fields', async ({ page }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/CLAUDE/usage?period=30d`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.json();

    for (const entry of body.bySource) {
      expect(entry).toHaveProperty('source');
      expect(entry).toHaveProperty('tokensIn');
      expect(entry).toHaveProperty('tokensOut');
      expect(entry).toHaveProperty('calls');
      expect(entry).toHaveProperty('costUsd');
    }
  });

  test('3.5 dailySeries entries have YYYY-MM-DD date format', async ({
    page,
  }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/CLAUDE/usage?period=30d`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.json();

    for (const entry of body.dailySeries) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('costUsd');
      expect(entry).toHaveProperty('tokens');
      expect(entry).toHaveProperty('calls');
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: API — Provider Models Endpoint
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('4 — API: GET /users/me/llm/:provider/models', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('4.1 Returns models for configured providers', async ({ page }) => {
    const token = await getToken(page);

    const res = await page.request.get(`${API_BASE}/users/me/llm/GROQ/models`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 if the key works, 4xx if there is none — never a 500
    expect(res.status()).not.toBe(500);
    if (res.status() === 200) {
      const body = await res.json();
      if (Array.isArray(body)) {
        expect(body.length).toBeGreaterThan(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: API — Usage Stats Endpoint
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('5 — API: GET /users/me/llm/usage', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('5.1 Returns usage stats with correct shape', async ({ page }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/usage?period=30d`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('totalInputTokens');
    expect(body).toHaveProperty('totalOutputTokens');
    expect(body).toHaveProperty('totalCostUsd');
    expect(body).toHaveProperty('byProvider');
    expect(body).toHaveProperty('period');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Trader > Settings > LLMs
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('6 — Trader LLM settings integration', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings/llms');
    await expect(page.locator('h1').filter({ hasText: /llms/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('6.1 Other Providers tab shows the provider key sections', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Other Providers' }).click();
    await expect(page.getByText('Groq', { exact: true }).first()).toBeVisible();
  });

  test('6.3 AI Usage Dashboard is reachable from Provider Analytics', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Provider Analytics' }).click();
    await expect(
      page.getByRole('button', { name: 'Provider Analytics' }),
    ).toHaveClass(/bg-card/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Performance & Security
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('7 — Performance & Security', () => {
  test.use({ storageState: TRADER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('7.1 Status endpoint responds under 5 seconds', async ({ page }) => {
    const token = await getToken(page);
    const started = Date.now();
    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  test('7.2 Usage endpoint responds under 3 seconds', async ({ page }) => {
    const token = await getToken(page);
    const started = Date.now();
    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/GROQ/usage?period=30d`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  test('7.3 Status endpoint does NOT leak API keys', async ({ page }) => {
    const token = await getToken(page);
    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const raw = await res.text();
    expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(raw).not.toMatch(/gsk_[a-zA-Z0-9]{20,}/);
    expect(raw).not.toContain('apiKey');
  });

  test('7.4 No auth → 401 for all provider endpoints', async ({ page }) => {
    for (const path of [
      '/users/me/llm/providers/status',
      '/users/me/llm/providers/CLAUDE/usage?period=30d',
      '/users/me/llm/usage?period=30d',
    ]) {
      const res = await page.request.get(`${API_BASE}${path}`);
      expect(res.status()).toBe(401);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Chat page
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('8 — Chat page loads', () => {
  test.use({ storageState: TRADER_STATE });

  test('8.1 Chat interface renders for logged-in user', async ({ page }) => {
    await page.goto('/dashboard/chat');

    const chatElement = page
      .getByRole('button', { name: /New session|Nueva sesión/i })
      .or(page.getByText(/Conversations|Conversaciones/i))
      .first();
    await expect(chatElement).toBeVisible({ timeout: 20_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Trading Config page
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('9 — Trading Config page', () => {
  test.use({ storageState: TRADER_STATE });

  test('9.1 Config page loads and shows the agents list', async ({ page }) => {
    await page.goto('/dashboard/config');
    await expect(
      page.locator('h1').filter({ hasText: /manage agents/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
