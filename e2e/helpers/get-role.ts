/**
 * Spec 30 — Helper: detectar rol del usuario en runtime
 * Usa el localStorage de auth-storage para leer el role del JWT actual
 */
import { Page } from '@playwright/test';

export async function getRole(page: Page): Promise<'ADMIN' | 'TRADER'> {
  try {
    const state = await page.context().storageState();
    const allEntries = state.origins.flatMap((o) => o.localStorage);
    // Zustand persist key (crypto-trader-auth) → { state: { user: { role } } }
    const zustandEntry = allEntries.find(
      (e) => e.name === 'crypto-trader-auth',
    );
    if (zustandEntry) {
      const parsed = JSON.parse(zustandEntry.value);
      const role = parsed?.state?.user?.role;
      if (role === 'ADMIN' || role === 'TRADER') return role;
    }
    // Fallback: token JWT directo en accessToken
    const tokenEntry = allEntries.find((e) => e.name === 'accessToken');
    if (tokenEntry) {
      try {
        const payload = JSON.parse(
          Buffer.from(tokenEntry.value.split('.')[1], 'base64').toString(),
        );
        if (payload?.role === 'ADMIN') return 'ADMIN';
        if (payload?.role === 'TRADER') return 'TRADER';
      } catch {
        // not a valid JWT
      }
    }
    return 'TRADER';
  } catch {
    return 'TRADER';
  }
}
