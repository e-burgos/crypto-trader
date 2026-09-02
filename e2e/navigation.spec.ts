import { test, expect, Page } from '@playwright/test';

/** The mobile drawer is portaled to body and stays in the DOM off-screen, so every
 *  sidebar assertion is scoped to the desktop <aside> to avoid strict-mode matches. */
function sidebar(page: Page) {
  return page.locator('aside');
}

test.describe('Sidebar — Navigation links', () => {
  test('navigates to Overview', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/portfolio overview/i)).toBeVisible({
      timeout: 8_000,
    });
  });

  test('navigates to Market via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await sidebar(page).getByRole('link', { name: 'Market', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/market$/);
    await expect(page.locator('h1').filter({ hasText: /market/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('navigates to Positions via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await sidebar(page)
      .getByRole('link', { name: 'Positions', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/positions/);
    await expect(
      page.locator('h1').filter({ hasText: /positions/i }),
    ).toBeVisible();
  });

  test('navigates to Trade History via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await sidebar(page)
      .getByRole('link', { name: 'Trade History', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/history/);
    await expect(
      page.locator('h1').filter({ hasText: /trade history/i }),
    ).toBeVisible();
  });

  test('navigates to Agent Log via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await sidebar(page)
      .getByRole('link', { name: 'Agent Log', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/agent-log/);
    await expect(
      page.locator('h1').filter({ hasText: /agent log/i }),
    ).toBeVisible();
  });

  test('navigates to Bot Analysis via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await sidebar(page)
      .getByRole('link', { name: 'Bot Analysis', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/bot-analysis/);
    await expect(
      page.locator('h1').filter({ hasText: /bot analysis/i }),
    ).toBeVisible();
  });

  test('navigates to News Analysis via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await sidebar(page)
      .getByRole('link', { name: 'News Analysis', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/news/);
    await expect(
      page.locator('h1').filter({ hasText: /news analysis/i }),
    ).toBeVisible();
  });

  test('navigates to Manage Agents via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await sidebar(page)
      .getByRole('link', { name: 'Manage Agents', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/config/);
    await expect(
      page.locator('h1').filter({ hasText: /manage agents/i }),
    ).toBeVisible();
  });

  test('navigates to the Exchange settings via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await sidebar(page)
      .getByRole('link', { name: 'Exchange', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/exchange/);
    await expect(
      page.locator('h1').filter({ hasText: /exchange/i }),
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
      await expect(html).not.toHaveClass(before || '', { timeout: 2_000 });
    }
  });
});

test.describe('Navbar — Language toggle', () => {
  test('switches language between EN and ES from the user menu', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const userMenu = page.getByRole('button', { name: 'User menu' });
    await expect(userMenu).toBeVisible({ timeout: 10_000 });
    await userMenu.click();
    await page.getByRole('button', { name: 'Español', exact: true }).click();
    await userMenu.click();
    await expect(
      page.getByRole('button', { name: 'English', exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Navbar — Notifications', () => {
  /** The dropdown is portaled to <body>; this pins it without matching the
   *  sidebar's own "Notifications" link. */
  const panelSelector = '[class*="top-[50px]"]';

  test('opens notifications dropdown on bell click', async ({ page }) => {
    await page.goto('/dashboard');
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 10_000 });
    await bellBtn.click();
    await expect(
      page.locator(panelSelector).getByText('Notifications', { exact: true }),
    ).toBeVisible({ timeout: 3_000 });
  });

  test('closes notifications dropdown on second click', async ({ page }) => {
    await page.goto('/dashboard');
    const bellBtn = page.getByRole('button', { name: 'Notifications' });
    await expect(bellBtn).toBeVisible({ timeout: 10_000 });
    await bellBtn.click();
    const panel = page.locator(panelSelector);
    await expect(panel).toBeVisible({ timeout: 3_000 });
    // The overlay (fixed inset-0 z-[9998]) covers the bell — force-click bypasses it
    await bellBtn.click({ force: true });
    await expect(panel).toHaveCount(0, { timeout: 5_000 });
  });
});

test.describe('Navbar — Dashboard link', () => {
  test('Dashboard button in navbar links to /dashboard', async ({ page }) => {
    await page.goto('/');
    // A logged-in TRADER on / is redirected to the dashboard by RoleRedirect
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});

test.describe('Navbar — Logout', () => {
  test('logout redirects away from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    const userMenu = sidebar(page).getByRole('button', { name: /@/ }).first();
    await expect(userMenu).toBeVisible({ timeout: 10_000 });
    await userMenu.click();
    await sidebar(page)
      .getByRole('button', { name: 'Sign Out', exact: true })
      .click();
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
