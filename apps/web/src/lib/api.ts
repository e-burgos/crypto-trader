const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface ApiError {
  message: string;
  statusCode: number;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  const rt = localStorage.getItem('refreshToken');
  if (!rt) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return null;
    const data: { accessToken: string; refreshToken?: string } =
      await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    // Persist rotated refresh token (issued on every refresh call)
    if (data.refreshToken)
      localStorage.setItem('refreshToken', data.refreshToken);
    // Keep Zustand store in sync so components reading accessToken stay current
    import('./api').then(() =>
      import('../store/auth.store').then(({ useAuthStore }) =>
        useAuthStore.setState({ accessToken: data.accessToken }),
      ),
    );
    return data.accessToken;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  _retry = true,
): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && _retry) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return request<T>(path, init, false);
    }
    // Refresh failed — log out
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Lazy import to avoid circular deps
    import('../store/auth.store').then(({ useAuthStore }) => {
      useAuthStore
        .getState()
        .logout()
        .catch(() => null);
    });
    throw {
      message: 'Sesión expirada. Por favor iniciá sesión de nuevo.',
      statusCode: 401,
    } as ApiError;
  }

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: 'Error en la solicitud' }));
    const errorMessage = Array.isArray(err.message)
      ? err.message.join('\n')
      : err.message || 'Error en la solicitud';
    throw {
      message: errorMessage,
      statusCode: res.status,
    } as ApiError;
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json();
}

async function requestFormData<T>(
  path: string,
  body: FormData,
  _retry = true,
): Promise<T> {
  const token = localStorage.getItem('accessToken');
  // Do NOT set Content-Type — browser sets it with the boundary for FormData
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  });

  if (res.status === 401 && _retry) {
    const newToken = await refreshToken();
    if (newToken) return requestFormData<T>(path, body, false);
    throw { message: 'Session expired.', statusCode: 401 } as ApiError;
  }

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: 'Error en la solicitud' }));
    const errorMessage = Array.isArray(err.message)
      ? err.message.join('\n')
      : err.message || 'Error en la solicitud';
    throw { message: errorMessage, statusCode: res.status } as ApiError;
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) =>
    requestFormData<T>(path, body),
  get: <T>(path: string) => request<T>(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
