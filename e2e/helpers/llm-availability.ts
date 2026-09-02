import { Page } from '@playwright/test';

export const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3000/api';

export const NO_LLM_KEYS_REASON =
  'El usuario no tiene credenciales LLM cargadas (CI no siembra claves): no se puede crear una sesión de chat.';

export const NO_USABLE_LLM_REASON =
  'Ninguna credencial LLM del usuario pertenece a un proveedor habilitado por la plataforma: el chat no puede completar una respuesta.';

/** A chat session cannot be created without at least one configured LLM provider. */
export async function hasLlmCredentials(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  if (!token) return false;
  try {
    const res = await page.request.get(
      `${API_BASE}/users/me/llm/providers/status`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
    );
    if (!res.ok()) return false;
    const body = await res.json();
    return Array.isArray(body) && body.length > 0;
  } catch {
    return false;
  }
}

/** A completion also needs the provider to be enabled platform-wide. */
export async function hasUsableLlmProvider(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  if (!token) return false;
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const [userRes, platformRes] = await Promise.all([
      page.request.get(`${API_BASE}/users/me/llm/providers/status`, {
        headers,
        timeout: 15_000,
      }),
      page.request.get(`${API_BASE}/llm-providers/status`, {
        headers,
        timeout: 15_000,
      }),
    ]);
    if (!userRes.ok() || !platformRes.ok()) return false;
    const userProviders = (await userRes.json()) as Array<{
      provider: string;
      keyStatus: string;
    }>;
    const platform = (await platformRes.json()) as Array<{
      provider: string;
      isActive: boolean;
    }>;
    const enabled = new Set(
      platform.filter((p) => p.isActive).map((p) => p.provider),
    );
    const configured = userProviders.some(
      (p) => p.keyStatus === 'ACTIVE' && enabled.has(p.provider),
    );
    if (!configured) return false;
    const keysRes = await page.request.get(
      `${API_BASE}/users/me/llm-keys/status`,
      {
        headers,
        timeout: 15_000,
      },
    );
    if (!keysRes.ok()) return false;
    const { providers } = (await keysRes.json()) as {
      providers: Array<{
        provider: string;
        selectedModel: string;
        isActive: boolean;
      }>;
    };
    const realProviders = new Set(
      providers
        .filter((k) => k.isActive && !k.selectedModel.startsWith('e2e/'))
        .map((k) => k.provider),
    );
    if (realProviders.size === 0) return false;
    const validation = await page.request.get(
      `${API_BASE}/users/me/llm-keys/validate-all`,
      { headers, timeout: 60_000 },
    );
    if (!validation.ok()) return false;
    const { results } = (await validation.json()) as {
      results: Array<{ provider: string; status: string }>;
    };
    return results.some(
      (r) =>
        r.status === 'ACTIVE' &&
        enabled.has(r.provider) &&
        realProviders.has(r.provider),
    );
  } catch {
    return false;
  }
}
