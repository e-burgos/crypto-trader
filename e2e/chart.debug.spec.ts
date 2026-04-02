import { test, expect } from '@playwright/test';

// Standalone: handles its own auth, no dependency on global setup
test.use({ storageState: { cookies: [], origins: [] } });

test('live chart renders candles', async ({ page }) => {
  const consoleLogs: string[] = [];
  const networkFails: string[] = [];

  const networkLogs: string[] = [];

  page.on('console', (msg) => {
    const t = msg.text();
    if (
      !t.includes('React Router') &&
      !t.includes('DevTools') &&
      !t.includes('[vite]')
    )
      consoleLogs.push(`[${msg.type()}] ${t}`);
  });
  page.on('pageerror', (err) => consoleLogs.push(`[PAGEERROR] ${err.message}`));
  page.on('requestfailed', (req) =>
    networkFails.push(`${req.url()} — ${req.failure()?.errorText}`),
  );
  page.on('response', (res) => {
    const url = res.url();
    if (
      url.includes('ohlcv') ||
      url.includes('binance') ||
      url.includes('klines')
    )
      networkLogs.push(`${res.status()} ${url}`);
  });

  // step 1 — login via form
  await page.goto('/login');
  await page.locator('#email').fill('trader@cryptotrader.dev');
  await page.locator('#password').fill('trader123');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15_000 });
  console.log('Logged in, URL:', page.url());

  // step 2 — navigate to chart
  await page.goto('/dashboard/chart');
  // wait for Binance fetch + chart render
  await page.waitForTimeout(8000);

  // collect DOM info + pixel sample from main canvas
  const info = await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas')).map(
      (c) => ({
        width: c.width,
        height: c.height,
        clientWidth: c.clientWidth,
        clientHeight: c.clientHeight,
      }),
    );
    // Sample pixels from the largest canvas to detect if any content is drawn
    const mainCanvas = Array.from(document.querySelectorAll('canvas')).find(
      (c) => c.width > 500 && c.height > 200,
    ) as HTMLCanvasElement | null;
    const pixelSamples: string[] = [];
    if (mainCanvas) {
      const ctx = mainCanvas.getContext('2d');
      if (ctx) {
        // Sample 5 points across the canvas center row
        const y = Math.floor(mainCanvas.height / 2);
        for (let i = 1; i <= 5; i++) {
          const x = Math.floor((mainCanvas.width / 6) * i);
          const d = ctx.getImageData(x, y, 1, 1).data;
          pixelSamples.push(
            `(${x},${y}) rgba(${d[0]},${d[1]},${d[2]},${d[3]})`,
          );
        }
      }
    }
    const wrapper = document.querySelector(
      '.rounded-xl.border',
    ) as HTMLElement | null;
    return {
      url: location.href,
      canvasCount: canvases.length,
      canvases,
      pixelSamples,
      wrapperW: wrapper?.clientWidth ?? null,
      wrapperH: wrapper?.clientHeight ?? null,
    };
  });

  console.log('=== URL ===', info.url);
  if (networkLogs.length)
    console.log('=== OHLCV/BINANCE REQUESTS ===\n' + networkLogs.join('\n'));
  console.log('=== CONSOLE ===\n' + consoleLogs.join('\n'));
  if (networkFails.length)
    console.log('=== NET FAILS ===\n' + networkFails.join('\n'));
  console.log('=== DOM ===\n' + JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'e2e/chart-debug.png' });

  expect(info.url).toContain('/dashboard/chart');
  expect(info.canvasCount).toBeGreaterThan(0);
  expect(info.canvases[0].width).toBeGreaterThan(100);
  expect(info.canvases[0].height).toBeGreaterThan(100);
});
