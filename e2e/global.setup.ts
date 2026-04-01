import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await page
    .getByLabel(/email/i)
    .fill(process.env.E2E_USER_EMAIL || 'test@example.com');
  await page
    .getByLabel(/password/i)
    .fill(process.env.E2E_USER_PASSWORD || 'Password123!');
  await page.getByRole('button', { name: /sign in|login/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 10_000 });
  await expect(page).toHaveURL(/dashboard/);

  // Save auth state
  await page.context().storageState({ path: authFile });
});
