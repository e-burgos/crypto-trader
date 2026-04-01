import { test, expect } from '@playwright/test';

test.describe('Auth — Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // unauthenticated for these

  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('bad@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    // Expect an error message (toast or inline)
    await expect(page.locator('[role="alert"], .error, [data-sonner-toast]').first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('register page renders all fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create account|register|sign up/i })).toBeVisible();
  });
});
