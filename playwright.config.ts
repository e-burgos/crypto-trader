import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load .env file so GROQ_API_KEY and other variables are available in E2E setup
dotenv.config({ path: '.env' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // ── Setup original ────────────────────────────────────────────────────────
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: [/.*\.unauth\.spec\.ts/, /multi-agent.*\.spec\.ts/],
    },
    {
      name: 'unauthenticated',
      testMatch: /.*\.unauth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Spec 30 — Multi-agent QA: auth setups ────────────────────────────────
    {
      name: 'setup-admin',
      testMatch: /global\.setup-admin\.ts/,
    },
    {
      name: 'setup-trader',
      testMatch: /global\.setup-trader\.ts/,
    },

    // ── Spec 30 — Multi-agent QA: proyectos por rol ──────────────────────────
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup-admin'],
      testMatch: /multi-agent.*\.spec\.ts/,
    },
    {
      name: 'chromium-trader',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/trader.json',
      },
      dependencies: ['setup-trader'],
      testMatch: /multi-agent.*\.spec\.ts/,
    },

    // ── Spec 30 — headed-debug: browser visible en tiempo real ───────────────
    // Usar con: pnpm playwright test --project=headed-debug --headed --slowMo=400
    {
      name: 'headed-debug',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        launchOptions: { slowMo: 400 },
        storageState: 'e2e/.auth/admin.json',
        video: 'retain-on-failure',
        screenshot: 'on',
      },
      dependencies: ['setup-admin'],
      testMatch: /multi-agent.*\.spec\.ts/,
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm nx serve web',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
