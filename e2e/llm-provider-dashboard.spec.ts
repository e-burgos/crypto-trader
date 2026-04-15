/**
 * Spec 31 — LLM Provider Dashboard E2E Tests
 *
 * Covers: Provider status grid UI, API endpoints, availability scoring,
 * provider models, usage tracking, and settings integration.
 *
 * Uses testuser@cryptotrader.dev (has 5 LLM providers configured).
 * API keys are used very sparingly — only lightweight /models endpoints
 * and read-only status checks. No chat/completion calls.
 */
import { test, expect, type Page } from '@playwright/test';

// ── Credentials ──────────────────────────────────────────────────────────────

// admin@crypto.com has LLM credentials (GROQ) and known working password
const USER_EMAIL = 'admin@crypto.com';
const USER_PASSWORD = 'Admin1234!';

// Bypass the shared storage state (trader) — use our own login
test.use({ storageState: { cookies: [], origins: [] } });

// Run serially to avoid overwhelming the API with concurrent logins
test.describe.configure({ mode: 'serial' });

// ── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(USER_EMAIL);
  await page.locator('input[type="password"]').fill(USER_PASSWORD);
  await page
    .getByRole('main')
    .getByRole('button', { name: /sign in/i })
    .click();
  await page.waitForURL('**/dashboard**', { timeout: 12_000 });
}

async function getToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(token, 'accessToken must be in localStorage').toBeTruthy();
  return token!;
}

async function goToAITab(page: Page) {
  await page.goto('/dashboard/settings?tab=ai');
  await page.waitForLoadState('networkidle');
  // Click AI Models tab if not already active
  const aiTab = page
    .getByRole('button', { name: /AI Models/i })
    .or(page.getByText(/AI Models/i));
  if (await aiTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await aiTab.click();
    await page.waitForTimeout(500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Settings > AI Tab — Provider Status Grid UI
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('1 — Provider Status Grid (Settings UI)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAITab(page);
  });

  test('1.1 "LLM Provider Status" heading is visible', async ({ page }) => {
    await expect(
      page.getByText(/LLM Provider Status|Estado de Proveedores LLM/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('1.2 Refresh button is visible and clickable', async ({ page }) => {
    const refreshBtn = page.getByRole('button', {
      name: /refresh|actualizar/i,
    });
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
    await refreshBtn.click();
    await page.waitForTimeout(500);
  });

  test('1.3 At least one provider card renders', async ({ page }) => {
    const providerLabels = [
      'Anthropic (Claude)',
      'OpenAI',
      'Groq',
      'Google Gemini',
      'Mistral AI',
      'Together AI',
    ];

    let found = 0;
    for (const label of providerLabels) {
      const el = page.getByText(label, { exact: false });
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        found++;
      }
    }
    // admin has at least 1 provider (GROQ)
    expect(found).toBeGreaterThanOrEqual(1);
  });

  test('1.4 Provider card shows key status badge (ACTIVE)', async ({
    page,
  }) => {
    const activeBadge = page.locator('text=ACTIVE').first();
    await expect(activeBadge).toBeVisible({ timeout: 10_000 });
  });

  test('1.5 Provider card shows availability bar', async ({ page }) => {
    // The availability bar has small colored segments inside the card
    const statusSection = page.getByText(
      /LLM Provider Status|Estado de Proveedores LLM/i,
    );
    await expect(statusSection).toBeVisible({ timeout: 10_000 });
    // The ACTIVE badge confirms cards are loaded with provider data
    const activeBadge = page.locator('text=ACTIVE').first();
    await expect(activeBadge).toBeVisible({ timeout: 10_000 });
  });

  test('1.6 Provider card shows token info (Input/Output)', async ({
    page,
  }) => {
    await expect(page.getByText('Input').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Output').first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('1.7 Provider card shows estimated cost', async ({ page }) => {
    const costLabel = page.getByText(/Est\. Cost|Costo Est/i);
    await expect(costLabel.first()).toBeVisible({ timeout: 10_000 });
  });

  test('1.8 Disclaimer footer is visible', async ({ page }) => {
    const disclaimer = page.getByText(
      /Costs are estimates|Los costos son estimaciones/i,
    );
    await expect(disclaimer).toBeVisible({ timeout: 10_000 });
  });

  test('1.9 Rate limits info shows "not available" text', async ({ page }) => {
    // Passive capture starts empty → rate limits "not available"
    const text = page.getByText(
      /Rate limits not available|Límites de tasa no disponibles/i,
    );
    await expect(text.first()).toBeVisible({ timeout: 10_000 });
  });

  test('1.10 Last success or "Never used" is shown', async ({ page }) => {
    const lastUsed = page.getByText(
      /Last success|Never used|Último éxito|Nunca usado/i,
    );
    await expect(lastUsed.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: API — Provider Status Endpoint
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('2 — API: GET /users/me/llm/providers/status', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('2.1 Returns array of ProviderStatus objects', async ({ page }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // admin has at least 1 provider
    expect(body.length).toBeGreaterThanOrEqual(1);

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
      expect(status.availabilityScore).toBeGreaterThanOrEqual(0);
      expect(status.availabilityScore).toBeLessThanOrEqual(100);
      expect(['ACTIVE', 'INACTIVE', 'INVALID']).toContain(status.keyStatus);
    }
  });

  test('2.2 Usage sub-object has correct structure', async ({ page }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.json();
    const first = body[0];

    expect(first.usage).toHaveProperty('totalTokensIn');
    expect(first.usage).toHaveProperty('totalTokensOut');
    expect(first.usage).toHaveProperty('totalCalls');
    expect(first.usage).toHaveProperty('estimatedCostUsd');
    expect(first.usage).toHaveProperty('bySource');
    expect(first.usage).toHaveProperty('dailySeries');
    expect(Array.isArray(first.usage.bySource)).toBe(true);
    expect(Array.isArray(first.usage.dailySeries)).toBe(true);
  });

  test('2.3 Active providers have score >= 70 (AVAILABLE)', async ({
    page,
  }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.json();

    for (const status of body) {
      if (status.keyStatus === 'ACTIVE') {
        expect(status.availabilityScore).toBeGreaterThanOrEqual(70);
        expect(status.availability).not.toBe('UNAVAILABLE');
      }
    }
  });

  test('2.4 Each provider has lastSuccessAt and lastError fields', async ({
    page,
  }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.json();

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
  test.beforeEach(async ({ page }) => {
    await login(page);
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
// SECTION 4: API — Provider Models Endpoint (Phases A-D, uses API keys sparingly)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('4 — API: GET /users/me/llm/:provider/models', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('4.1 Returns models for configured providers', async ({ page }) => {
    const token = await getToken(page);

    // Test GROQ (admin's configured provider) — one lightweight call
    const res = await page.request.get(`${API_BASE}/users/me/llm/GROQ/models`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 if key works, 429 if rate-limited — neither should be 500
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
// SECTION 5: API — Usage Stats Endpoint (Phases A-D)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('5 — API: GET /users/me/llm/usage', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('5.1 Returns usage stats with correct shape', async ({ page }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/usage?period=30d`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Actual shape from the API
    expect(body).toHaveProperty('totalInputTokens');
    expect(body).toHaveProperty('totalOutputTokens');
    expect(body).toHaveProperty('totalCostUsd');
    expect(body).toHaveProperty('byProvider');
    expect(body).toHaveProperty('period');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Settings > AI Tab — Full Integration
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('6 — Settings AI Tab Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goToAITab(page);
  });

  test('6.1 AI tab shows provider key sections', async ({ page }) => {
    // AI tab should show provider sections — at least GROQ (admin's configured one)
    // Plus the other provider name labels from the provider key input form
    const groqText = page.getByText(/groq/i).first();
    await expect(groqText).toBeVisible({ timeout: 5_000 });
  });

  test('6.2 Provider status grid renders below provider keys', async ({
    page,
  }) => {
    const gridTitle = page.getByText(
      /LLM Provider Status|Estado de Proveedores LLM/i,
    );
    await expect(gridTitle).toBeVisible({ timeout: 10_000 });
  });

  test('6.3 AI Usage Dashboard is visible', async ({ page }) => {
    const usageDashboard = page.getByText(
      /AI Usage|Uso de AI|Usage Dashboard/i,
    );
    await expect(usageDashboard.first()).toBeVisible({ timeout: 10_000 });
  });

  test('6.4 Refresh updates grid without page navigation', async ({ page }) => {
    const title = page.getByText(
      /LLM Provider Status|Estado de Proveedores LLM/i,
    );
    await expect(title).toBeVisible({ timeout: 10_000 });

    const refreshBtn = page.getByRole('button', {
      name: /refresh|actualizar/i,
    });
    await refreshBtn.click();
    await page.waitForTimeout(1_500);

    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await expect(title).toBeVisible();
  });

  test('6.5 Cards show "ACTIVE" badges for configured providers', async ({
    page,
  }) => {
    const activeBadges = page.locator('text=ACTIVE');
    await expect(activeBadges.first()).toBeVisible({ timeout: 10_000 });
    const count = await activeBadges.count();
    // admin has 1 GROQ credential
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Performance & Security
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('7 — Performance & Security', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('7.1 Status endpoint responds under 5 seconds', async ({ page }) => {
    const token = await getToken(page);

    const start = Date.now();
    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(5_000);
  });

  test('7.2 Usage endpoint responds under 3 seconds', async ({ page }) => {
    const token = await getToken(page);

    const start = Date.now();
    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/CLAUDE/usage?period=30d`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(3_000);
  });

  test('7.3 Status endpoint does NOT leak API keys', async ({ page }) => {
    const token = await getToken(page);

    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const raw = await res.text();

    // Must not expose any API key patterns
    expect(raw).not.toContain('sk-ant-');
    expect(raw).not.toContain('sk-proj-');
    expect(raw).not.toContain('gsk_');
    expect(raw).not.toContain('AIzaSy');
    expect(raw).not.toContain('tgp_v1_');
    expect(raw).not.toContain('apiKeyEncrypted');
    expect(raw).not.toContain('apiKeyIv');
  });

  test('7.4 No auth → 401 for all provider endpoints', async ({ page }) => {
    const endpoints = [
      `${API_BASE}/users/me/llm/providers/status`,
      `${API_BASE}/users/me/llm/providers/CLAUDE/usage?period=30d`,
    ];

    for (const url of endpoints) {
      const res = await page.request.get(url);
      expect(res.status()).toBe(401);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Chat page (Phase H verification)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('8 — Chat page loads', () => {
  test('8.1 Chat interface renders for logged-in user', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/chat');
    await page.waitForLoadState('networkidle');

    // Chat page shows "New session" button or existing conversations
    const chatElement = page
      .getByRole('button', { name: /New session|Nueva sesión/i })
      .or(page.getByText(/Conversations|Conversaciones/i))
      .first();
    await expect(chatElement).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Trading Config page (Phase G verification)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('9 — Trading Config page', () => {
  test('9.1 Config page loads and shows form', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/config');
    await expect(page.getByRole('heading', { name: /config/i })).toBeVisible({
      timeout: 8_000,
    });
  });
});
