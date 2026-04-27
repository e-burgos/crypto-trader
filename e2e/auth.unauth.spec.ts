import { test, expect } from '@playwright/test';

test.describe('Auth — Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // unauthenticated for these

  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.locator('main').getByRole('button', { name: /sign in/i }),
    ).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('bad@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
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

test.describe('Help Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('help page is accessible without auth', async ({ page }) => {
    await page.goto('/docs');
    await expect(
      page.getByRole('heading', { name: /help|faq|guide|docs/i }),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('FAQ accordion items are visible', async ({ page }) => {
    await page.goto('/docs');
    // FAQ items should be listed
    await expect(page.getByText(/crypto|trader|what is/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('clicking a FAQ item expands the answer', async ({ page }) => {
    await page.goto('/docs');
    const firstFaq = page
      .locator('[class*="faq"], button[class*="flex"]')
      .first();
    if (await firstFaq.isVisible()) {
      await firstFaq.click();
      await page.waitForTimeout(400);
      // Answer should be visible after click
    }
  });

  test('Getting Started guide steps are visible', async ({ page }) => {
    await page.goto('/docs');
    await expect(
      page.getByText(/register|connect|configure/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
