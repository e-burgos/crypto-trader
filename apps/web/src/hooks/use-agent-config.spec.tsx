import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../lib/i18n';
import {
  useAgentConfigs,
  useAgentHealth,
  useUpdateAgentConfig,
  useResetAgentConfig,
  useApplyRecommendedPreset,
} from './use-agent-config';
import {
  AGENTS_HEALTH_FIXTURE,
  AGENTS_WIRE_FIXTURE,
} from '../pages/dashboard/settings/agents-wire.fixture';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { api } from '../lib/api';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAgentConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the wire config typed by slot', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(AGENTS_WIRE_FIXTURE);

    const { result } = renderHook(() => useAgentConfigs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/users/me/agents/config');
    expect(result.current.data?.every((c) => 'slot' in c)).toBe(true);
    expect(result.current.data?.map((c) => c.slot)).toContain('risk');
  });
});

describe('useAgentHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the wire health report typed by slot', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(AGENTS_HEALTH_FIXTURE);

    const { result } = renderHook(() => useAgentHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/users/me/agents/health');
    expect(result.current.data?.agents.every((a) => 'slot' in a)).toBe(true);
  });
});

describe('useUpdateAgentConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PUTs the slot in the URL, never undefined', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useUpdateAgentConfig(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      slot: 'market',
      provider: 'OPENROUTER',
      model: 'deepseek/deepseek-v4-pro',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.put).toHaveBeenCalledWith('/users/me/agents/market/config', {
      provider: 'OPENROUTER',
      model: 'deepseek/deepseek-v4-pro',
    });
  });
});

describe('useResetAgentConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DELETEs the slot in the URL, never undefined', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useResetAgentConfig(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ slot: 'risk' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.delete).toHaveBeenCalledWith('/users/me/agents/risk/config');
  });
});

describe('useApplyRecommendedPreset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PUTs each recommended model keyed by slot when every model validates', async () => {
    vi.mocked(api.put).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useApplyRecommendedPreset(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      tier: 'free',
      models: {
        routing: {
          free: 'google/gemma-4-26b-a4b-it:free',
          balanced: 'qwen/qwen3.5-9b',
          optimized: 'deepseek/deepseek-v4-flash',
        },
        risk: {
          free: 'nvidia/nemotron-3-super-120b-a12b:free',
          balanced: 'deepseek/deepseek-v4-pro',
          optimized: 'moonshotai/kimi-k2.6',
        },
      },
      availableModelIds: new Set([
        'google/gemma-4-26b-a4b-it:free',
        'nvidia/nemotron-3-super-120b-a12b:free',
      ]),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.put).toHaveBeenCalledWith('/users/me/agents/routing/config', {
      provider: 'OPENROUTER',
      model: 'google/gemma-4-26b-a4b-it:free',
    });
    expect(api.put).toHaveBeenCalledWith('/users/me/agents/risk/config', {
      provider: 'OPENROUTER',
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
    });
  });
});
