import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSourceCategoryType } from '@crypto-trader/shared';
import { SettingsDataSourcesPage } from './data-sources';
import type { TraderDataSourceInfo } from '../../../hooks/use-trader-data-sources';

vi.mock('../../../lib/api', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../../lib/api';

const SEEDED: Array<[string, DataSourceCategoryType, boolean]> = [
  ['coingecko', 'MARKET_DATA', false],
  ['altfins', 'TECHNICAL', false],
  ['coinalyze', 'DERIVATIVES', true],
  ['finnhub', 'NEWS', true],
  ['alternative_me', 'SENTIMENT', false],
  ['defillama', 'DEFI_ONCHAIN', false],
  ['polymarket', 'PREDICTION', false],
  ['messari', 'TOKEN_UNLOCKS', false],
];

function source(
  name: string,
  category: DataSourceCategoryType,
  requiresApiKey: boolean,
): TraderDataSourceInfo {
  return {
    id: `ds-${name}`,
    name,
    displayName: `Display ${name}`,
    category,
    isActive: true,
    requiresApiKey,
    monthlyCostUsd: 0,
    health: 'healthy',
    hasOwnCredential: false,
    hasSharedCredential: false,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsDataSourcesPage />
    </QueryClientProvider>,
  );
}

describe('SettingsDataSourcesPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CA-009: renders every seeded source, one per canonical category', async () => {
    vi.mocked(api.get).mockResolvedValue({
      sources: SEEDED.map(([n, c, r]) => source(n, c, r)),
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Display coingecko')).toBeInTheDocument(),
    );
    for (const [name] of SEEDED) {
      expect(screen.getByText(`Display ${name}`)).toBeInTheDocument();
    }
  });

  it('never silently drops a category the page does not know', async () => {
    vi.mocked(api.get).mockResolvedValue({
      sources: [
        source('known', 'NEWS', false),
        source('exotic', 'SOMETHING_NEW' as DataSourceCategoryType, false),
      ],
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Display known')).toBeInTheDocument(),
    );
    expect(screen.getByText('Display exotic')).toBeInTheDocument();
    expect(screen.getAllByText('SOMETHING_NEW').length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('summarises access state across the sources', async () => {
    vi.mocked(api.get).mockResolvedValue({
      sources: [
        { ...source('a', 'NEWS', true), hasOwnCredential: true },
        { ...source('b', 'DERIVATIVES', true), hasSharedCredential: true },
        source('c', 'SENTIMENT', true),
      ],
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Display a')).toBeInTheDocument(),
    );
    expect(screen.getByText('Own key:').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Admin shared:').nextSibling).toHaveTextContent(
      '1',
    );
    expect(screen.getByText('No key:').nextSibling).toHaveTextContent('1');
  });
});
