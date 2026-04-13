/**
 * Spec 30 — Setup de autenticación TRADER
 * Genera: e2e/.auth/trader.json
 * También configura la clave Groq real si existe en el entorno.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/trader.json');

setup('authenticate as trader', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('trader@crypto.com');
  await page.locator('input[type="password"]').fill('Trader1234!');
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
    const token = await page.evaluate(() =>
      localStorage.getItem('accessToken'),
    );
    if (token) {
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
      console.log(`[setup-trader] LLM key update: ${res.status()}`);
    }
  } else {
    console.log(
      '[setup-trader] No valid GROQ_API_KEY in env — skipping key setup',
    );
  }

  await page.context().storageState({ path: authFile });
});
