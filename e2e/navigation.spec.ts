import { test, expect } from '@playwright/test';

// ─── Sidebar Navigation ────────────────────────────────────────────────────────
test.describe('Sidebar — Navigation links', () => {
  test('navigates to Overview', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/portfolio overview/i)).toBeVisible({
      timeout: 8_000,
    });
  });

  test('navigates to Live Chart via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /live chart/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/chart/);
    await expect(page.locator('canvas, [class*="chart"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('navigates to Positions via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /positions/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/positions/);
    await expect(
      page.getByRole('heading', { name: /positions/i }),
    ).toBeVisible();
  });

  test('navigates to Trade History via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /trade history/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/history/);
    await expect(
      page.getByRole('heading', { name: /trade history/i }),
    ).toBeVisible();
  });

  test('navigates to Agent Log via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /agent log/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/agent/);
    await expect(
      page.getByRole('heading', { name: 'Agent Log', exact: true }),
    ).toBeVisible();
  });

  test('navigates to Analytics via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /analytics/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/analytics/);
    await expect(
      page.getByRole('heading', { name: /analytics/i }),
    ).toBeVisible();
  });

  test('navigates to News Feed via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /news/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/news/);
    await expect(page.getByRole('heading', { name: /news/i })).toBeVisible();
  });

  test('navigates to Configuration via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /config/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/config/);
    await expect(page.getByRole('heading', { name: /config/i })).toBeVisible();
  });

  test('navigates to Settings via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await expect(
      page.getByRole('heading', { name: /settings/i }),
    ).toBeVisible();
  });
});

// ─── Navbar ────────────────────────────────────────────────────────────────────
test.describe('Navbar — Theme toggle', () => {
  test('toggles dark/light mode', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const themeBtn = page.getByRole('button', { name: /toggle theme/i });

    if (await themeBtn.isVisible()) {
      const before = await html.getAttribute('class');
      await themeBtn.click();
      // Class should change
      await expect(html).not.toHaveClass(before || '', { timeout: 2_000 });
    }
  });
});

test.describe('Navbar — Language toggle', () => {
  test('switches language between EN and ES', async ({ page }) => {
    // Language toggle is accessible in both Navbar (public) and DashboardHeader
    await page.goto('/dashboard');
    const langBtn = page.getByRole('button', { name: /toggle language/i });
    await expect(langBtn).toBeVisible({ timeout: 5_000 });
    const initialText = await langBtn.textContent();
    await langBtn.click();
    // After click, button text should flip
    const afterText = await langBtn.textContent();
    expect(afterText).not.toBe(initialText);
  });
});

test.describe('Navbar — Notifications', () => {
  test('opens notifications dropdown on bell click', async ({ page }) => {
    await page.goto('/dashboard');
    // Bell is in DashboardHeader with exact aria-label
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 5_000 });
    await bellBtn.click();
    // Dropdown should appear
    await expect(page.getByText(/notifications/i).nth(1)).toBeVisible({
      timeout: 3_000,
    });
  });

  test('closes notifications dropdown on second click', async ({ page }) => {
    await page.goto('/dashboard');
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 5_000 });
    await bellBtn.click();
    // Dropdown should appear
    const dropdownHeader = page.getByText(/notifications/i).nth(1);
    await expect(dropdownHeader).toBeVisible({ timeout: 3_000 });
    // The overlay (fixed inset-0 z-40) covers the bell — force-click bypasses overlay
    await bellBtn.click({ force: true });
    await page.waitForTimeout(300);
    await expect(dropdownHeader).not.toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Navbar — Dashboard link', () => {
  test('Dashboard button in navbar links to /dashboard', async ({ page }) => {
    await page.goto('/');
    // When logged in, Navbar shows a Dashboard link
    const dashBtn = page.getByRole('link', { name: /dashboard/i }).first();
    await expect(dashBtn).toBeVisible();
    await dashBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Navbar — Logout', () => {
  test('logout redirects to landing page', async ({ page }) => {
    await page.goto('/dashboard');
    // Logout is in sidebar
    const logoutBtn = page.getByRole('button', {
      name: /log out|logout|sign out/i,
    });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    // Should redirect away from dashboard
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5_000 });
  });
});
