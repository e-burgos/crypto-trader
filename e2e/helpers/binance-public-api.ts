import { request } from '@playwright/test';

export const BINANCE_UNREACHABLE_REASON =
  'La API pública de Binance no es alcanzable desde este runner (bloqueo geográfico/red): el gráfico de velas no puede cargar datos.';

let cachedReachable: boolean | null = null;

export async function isBinancePublicApiReachable(): Promise<boolean> {
  if (cachedReachable !== null) return cachedReachable;
  try {
    const context = await request.newContext();
    const res = await context.get('https://api.binance.com/api/v3/ping', {
      timeout: 10_000,
    });
    cachedReachable = res.ok();
    await context.dispose();
  } catch {
    cachedReachable = false;
  }
  return cachedReachable;
}
