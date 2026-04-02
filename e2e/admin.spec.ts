import { test, expect } from '@playwright/test';

// Admin panel — requires user with role ADMIN
// The trader@cryptotrader.dev user is NOT admin, so we test the redirect behavior
test.describe('Admin — Non-admin user redirect', () => {
  test('redirects non-admin user to /dashboard', async ({ page }) => {
    await page.goto('/admin');
    // AdminLayout redirects to /dashboard when user is not ADMIN
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8_000 });
  });

  test('/admin/users also redirects non-admin to /dashboard', async ({
    page,
  }) => {
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8_000 });
  });
});

// NOTE: To test the admin panel itself, create a separate auth state
// for an admin user and add a new Playwright project with that storageState.
// Admin tests with an admin account:
//   - Stats page shows total users, trades, revenue
//   - Users tab shows user list with roles
//   - Tab navigation between Stats and Users
