/**
 * Spec 30 — Setup de autenticación ADMIN
 * Genera: e2e/.auth/admin.json
 * También configura la clave Groq real si existe en el entorno.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('admin@crypto.com');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page
    .getByRole('main')
    .getByRole('button', { name: /sign in/i })
    .click();
  await page.waitForURL('**/dashboard**', { timeout: 12_000 });
  await expect(page).toHaveURL(/dashboard/);

  // Configure real Groq API key if available in the environment
  const groqApiKey = process.env['GROQ_API_KEY'];
  if (
    groqApiKey &&
    !groqApiKey.includes('dummy') &&
    !groqApiKey.includes('test_key')
  ) {
    // Get auth token from localStorage — stored directly as 'accessToken'
    const token = await page.evaluate(() =>
      localStorage.getItem('accessToken'),
    );
    if (token) {
      // Use direct API URL (port 3000) since Vite doesn't proxy /api
      const apiBase = 'http://localhost:3000';
      const res = await page.request.post(`${apiBase}/api/users/me/llm-keys`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          provider: 'GROQ',
          apiKey: groqApiKey,
          selectedModel: 'llama-3.3-70b-versatile',
        }),
      });
      console.log(`[setup-admin] LLM key update: ${res.status()}`);
    } else {
      console.log('[setup-admin] No access token found in localStorage');
    }
  } else {
    console.log(
      '[setup-admin] No valid GROQ_API_KEY in env — skipping key setup',
    );
  }

  await page.context().storageState({ path: authFile });
});
