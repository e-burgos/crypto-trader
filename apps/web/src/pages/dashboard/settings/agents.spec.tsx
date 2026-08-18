import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsAgentsPage } from './agents';
import {
  AGENTS_HEALTH_FIXTURE,
  AGENTS_WIRE_FIXTURE,
  OPENROUTER_MODELS_FIXTURE,
} from './agents-wire.fixture';
import { useAuthStore } from '../../../store/auth.store';

vi.mock('../../../lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { api } from '../../../lib/api';

function mockApiGet(configs = AGENTS_WIRE_FIXTURE) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/users/me/agents/config') {
      return Promise.resolve(configs);
    }
    if (url.startsWith('/users/me/agents/health')) {
      return Promise.resolve(AGENTS_HEALTH_FIXTURE);
    }
    if (url.startsWith('/openrouter/models')) {
      return Promise.resolve({
        data: OPENROUTER_MODELS_FIXTURE,
        count: OPENROUTER_MODELS_FIXTURE.length,
      });
    }
    if (url === '/llm-providers/status') {
      return Promise.resolve([]);
    }
    if (url === '/users/me/llm-keys/status') {
      return Promise.resolve({ providers: [] });
    }
    return Promise.resolve([]);
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsAgentsPage />
    </QueryClientProvider>,
  );
}

describe('SettingsAgentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: false });
  });

  it('renders every agent name from slot, never a literal undefined (CA-064)', async () => {
    mockApiGet();
    renderPage();

    await waitFor(() => screen.getByText('AEGIS'));

    expect(screen.getAllByText('KRYPTO').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('NEXUS')).toBeInTheDocument();
    expect(screen.getByText('FORGE')).toBeInTheDocument();
    expect(screen.getByText('SIGMA')).toBeInTheDocument();
    expect(screen.getByText('CIPHER')).toBeInTheDocument();
    expect(screen.getByText('AEGIS')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    expect(screen.queryByText(/\(undefined\)/)).not.toBeInTheDocument();
  });

  it('groups every fixture agent into the nav without dropping or duplicating any (CA-065)', async () => {
    mockApiGet();
    renderPage();

    await waitFor(() => screen.getByText('AEGIS'));

    for (const { slot } of AGENTS_WIRE_FIXTURE) {
      expect(screen.getAllByText(slot)).toHaveLength(1);
    }
  });

  it('saves with the real slot in the URL, never .../agents/undefined/config (CA-066)', async () => {
    mockApiGet();
    vi.mocked(api.put).mockResolvedValue({ success: true });
    renderPage();

    await waitFor(() => screen.getAllByText('KRYPTO').length > 0);

    const freeModelButton = await screen.findByText(
      'google/gemma-4-26b-a4b-it:free',
    );
    fireEvent.click(freeModelButton);

    const saveButton = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/users/me/agents/routing/config');
    expect(url).not.toContain('undefined');
  });

  it('degrades an unrecognized source without breaking the rest of the screen (CE-08)', async () => {
    const fixtureWithUnknownSource = AGENTS_WIRE_FIXTURE.map((agent) =>
      agent.slot === 'market' ? { ...agent, source: 'marciano' } : agent,
    ) as typeof AGENTS_WIRE_FIXTURE;
    mockApiGet(fixtureWithUnknownSource);
    renderPage();

    await waitFor(() => screen.getByText('AEGIS'));
    fireEvent.click(screen.getByText('market'));

    await waitFor(() => screen.getByText('Unknown Source'));
    expect(screen.getByText('AEGIS')).toBeInTheDocument();
    expect(screen.getAllByText('SIGMA').length).toBeGreaterThan(0);
    expect(screen.getByText('CIPHER')).toBeInTheDocument();
  });
});
