import { test, expect } from '@playwright/test';

test.describe('Auth — Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // unauthenticated for these

  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.locator('main').getByRole('button', { name: /sign in/i }),
    ).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('bad@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page
      .locator('main')
      .getByRole('button', { name: /sign in/i })
      .click();
    // Expect an error message (toast or inline)
    await expect(
      page
        .locator(
          '[role="alert"], .error, [data-sonner-toast], [class*="red-500"]',
        )
        .first(),
    ).toBeVisible({
      timeout: 5_000,
    });
  });

  test('logo / brand mark is visible on login page', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i }),
    ).toBeVisible();
  });

  test('has link to register page', async ({ page }) => {
    await page.goto('/login');
    const link = page
      .getByRole('link', {
        name: /register|sign up|create account|create one/i,
      })
      .first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/register/);
  });
});

test.describe('Auth — Register', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('register page renders all fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /create account|register|sign up/i }),
    ).toBeVisible();
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/email/i).fill('newuser@test.com');
    await page.getByLabel(/^password$/i).fill('password123');
    // Confirm password field (second password input)
    await page.getByLabel(/confirm/i).fill('different456');
    await page
      .getByRole('button', { name: /create account|register|sign up/i })
      .click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible({
      timeout: 3_000,
    });
  });

  test('shows error when password too short', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/email/i).fill('newuser@test.com');
    await page.getByLabel(/^password$/i).fill('short');
    await page.getByLabel(/confirm/i).fill('short');
    await page
      .getByRole('button', { name: /create account|register|sign up/i })
      .click();
    await expect(page.getByText(/at least 8/i)).toBeVisible({ timeout: 3_000 });
  });

  test('has link back to login page', async ({ page }) => {
    await page.goto('/register');
    // Use the in-form 'Sign in' link (lowercase) to avoid strict mode with navbar 'Sign In'
    const link = page
      .getByRole('link', { name: 'Sign in', exact: true })
      .last();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Docs', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('docs are reachable without auth and redirect to Quickstart', async ({
    page,
  }) => {
    await page.goto('/docs');
    await expect(page).toHaveURL(/\/docs\/quickstart$/);
    await expect(
      page.getByRole('heading', { name: 'Quickstart', exact: true }),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('FAQ page lists its questions', async ({ page }) => {
    await page.goto('/docs/faq');
    await expect(
      page.getByRole('heading', { name: 'FAQ', exact: true }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByRole('heading', { name: 'Is CryptoTrader free?' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Can I lose money?' }),
    ).toBeVisible();
  });

  test('FAQ answers render inline, without an accordion', async ({ page }) => {
    await page.goto('/docs/faq');
    await expect(page.locator('#faq-free')).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('#faq-free').getByText(/free to use/i),
    ).toBeVisible();
    await expect(page.locator('#faq-free button')).toHaveCount(0);
  });

  test('Quickstart shows the account creation steps', async ({ page }) => {
    await page.goto('/docs/quickstart');
    await expect(
      page.getByRole('heading', { name: /create your account/i }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByText(/navigate to the registration page/i),
    ).toBeVisible();
  });
});
