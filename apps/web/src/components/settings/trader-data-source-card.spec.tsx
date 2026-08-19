import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { TraderDataSourceCard } from './trader-data-source-card';
import type { TraderDataSourceInfo } from '../../hooks/use-trader-data-sources';

vi.mock('../../lib/api', () => ({
  api: { put: vi.fn(), delete: vi.fn() },
}));

const BASE: TraderDataSourceInfo = {
  id: 'ds-1',
  name: 'coinalyze',
  displayName: 'Coinalyze — Derivados Agregados',
  category: 'DERIVATIVES',
  isActive: true,
  requiresApiKey: true,
  monthlyCostUsd: 0,
  health: 'healthy',
  hasOwnCredential: false,
  hasSharedCredential: false,
};

function renderCard(source: Partial<TraderDataSourceInfo>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TraderDataSourceCard
        source={{ ...BASE, ...source }}
        onSetKey={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe('TraderDataSourceCard — access state', () => {
  it('CA-010: shows the own-key state when the trader has their own credential', () => {
    renderCard({ hasOwnCredential: true, hasSharedCredential: true });

    expect(screen.getByText(/Your key/)).toBeInTheDocument();
    expect(screen.queryByText('Admin shared')).not.toBeInTheDocument();
    expect(screen.getByText('Remove Key')).toBeInTheDocument();
  });

  it('CA-010: shows the shared state when only an admin credential is available', () => {
    renderCard({ hasOwnCredential: false, hasSharedCredential: true });

    expect(screen.getByText('Admin shared')).toBeInTheDocument();
    expect(screen.queryByText(/Your key/)).not.toBeInTheDocument();
    expect(screen.getByText('Set Key')).toBeInTheDocument();
  });

  it('CA-010: shows the no-key state when neither credential is available', () => {
    renderCard({ hasOwnCredential: false, hasSharedCredential: false });

    expect(screen.getByText('Key required')).toBeInTheDocument();
    expect(screen.getByText('Set Key')).toBeInTheDocument();
  });

  it('CA-011: a source that needs no key is shown as free and offers no key action', () => {
    renderCard({ requiresApiKey: false, displayName: 'CoinGecko' });

    expect(screen.queryByText('Key required')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Key')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove Key')).not.toBeInTheDocument();
  });

  it('CA-014: never renders the identity of the admin sharing the credential', () => {
    const { container } = renderCard({ hasSharedCredential: true });

    expect(container.textContent).not.toMatch(/admin-|@/i);
  });
});
