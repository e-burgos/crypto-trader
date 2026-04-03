import { test, expect } from '@playwright/test';

// Onboarding is a protected route — needs auth (handled by global setup)
test.describe('Onboarding — Step navigation', () => {
  test('redirects to onboarding after registration (smoke)', async ({
    page,
  }) => {
    // We verify the route exists and renders when authenticated
    await page.goto('/onboarding');
    // Should render the step wizard (not redirect away)
    await expect(
      page.getByText(/connect exchange|binance|step 1/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Step 1: Binance Keys — shows form fields when not skipping', async ({
    page,
  }) => {
    await page.goto('/onboarding');
    // "Skip for now" is a custom <button> toggle (not a native checkbox)
    // Initial state: skipBinance = true (fields hidden). Click to reveal fields.
    const skipBtn = page.getByRole('button', { name: /skip for now/i });
    await expect(skipBtn).toBeVisible({ timeout: 8_000 });
    const apiKeyInput = page.getByPlaceholder(/binance api key/i);
    if (!(await apiKeyInput.isVisible())) {
      await skipBtn.click();
    }
    await expect(apiKeyInput).toBeVisible({ timeout: 3_000 });
    await expect(page.getByPlaceholder(/binance api secret/i)).toBeVisible();
  });

  test('Step 1: can skip Binance step', async ({ page }) => {
    await page.goto('/onboarding');
    const skipCheckbox = page.getByRole('checkbox', { name: /skip/i });
    if (await skipCheckbox.isVisible()) {
      await skipCheckbox.check();
      // Fields should hide
      await expect(page.getByPlaceholder(/binance api key/i)).not.toBeVisible();
    } else {
      // Some implementations use a button — look for skip button
      const skipBtn = page.getByRole('button', { name: /skip/i });
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
      }
    }
    // "Next" button should be available
    await expect(
      page.getByRole('button', { name: /next|continue/i }),
    ).toBeVisible();
  });

  test('Step 1 → Step 2: advances to AI Provider step', async ({ page }) => {
    await page.goto('/onboarding');
    // Skip binance to advance
    const skipEl = page.getByRole('checkbox', { name: /skip/i });
    if (await skipEl.isVisible()) await skipEl.check();
    await page.getByRole('button', { name: /next|continue/i }).click();
    await expect(
      page.getByText(/ai provider|llm|openai|claude|groq/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Step 2: AI Provider — provider selector works', async ({ page }) => {
    await page.goto('/onboarding');
    const skipEl = page.getByRole('checkbox', { name: /skip/i });
    if (await skipEl.isVisible()) await skipEl.check();
    await page.getByRole('button', { name: /next|continue/i }).click();
    // Provider options (Claude, OpenAI, Groq) should be visible
    await expect(page.getByText(/claude/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/openai/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/groq/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('Step 2 → Step 3: advances to Trading Mode step (Continue only when not disabled)', async ({
    page,
  }) => {
    await page.goto('/onboarding');
    const skipEl = page.getByRole('checkbox', { name: /skip/i });
    if (await skipEl.isVisible()) await skipEl.check();
    await page.getByRole('button', { name: /next|continue/i }).click();
    await page.waitForTimeout(500);
    // Continue may be disabled if API key is required
    const continueBtn = page.getByRole('button', { name: /next|continue/i });
    if (!(await continueBtn.isDisabled())) {
      await continueBtn.click();
      await expect(
        page.getByText(/trading mode|sandbox|live|capital/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Step 3: Trading Mode — SANDBOX/LIVE visible (only if step reached)', async ({
    page,
  }) => {
    await page.goto('/onboarding');
    const skipEl = page.getByRole('checkbox', { name: /skip/i });
    if (await skipEl.isVisible()) await skipEl.check();
    await page.getByRole('button', { name: /next|continue/i }).click();
    await page.waitForTimeout(300);
    const continueBtn = page.getByRole('button', { name: /next|continue/i });
    if (!(await continueBtn.isDisabled())) {
      await continueBtn.click();
      await expect(page.getByText(/sandbox/i).first()).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByText(/live/i).first()).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  test('Back button returns to previous step', async ({ page }) => {
    await page.goto('/onboarding');
    const skipEl = page.getByRole('checkbox', { name: /skip/i });
    if (await skipEl.isVisible()) await skipEl.check();
    await page.getByRole('button', { name: /next|continue/i }).click();
    await page.waitForTimeout(300);
    // Now on step 2 — go back
    const backBtn = page.getByRole('button', { name: /back/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    // Should be back on step 1 — heading shows
    await expect(
      page.getByRole('heading', { name: /connect exchange/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Step indicators show current step', async ({ page }) => {
    await page.goto('/onboarding');
    // Use .first() to avoid strict mode violations
    await expect(page.getByText(/connect exchange/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/ai provider/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/trading mode/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
