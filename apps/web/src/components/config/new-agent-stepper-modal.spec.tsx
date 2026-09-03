import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateTradingConfigInput } from '@crypto-trader/shared';
import '../../lib/i18n';
import { NewAgentStepperModal } from './new-agent-stepper-modal';

vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { api } from '../../lib/api';

const POST_BODY_BEFORE_CYCLE: Readonly<CreateTradingConfigInput> = Object.freeze({
  name: 'Mi bot',
  asset: 'BTC',
  pair: 'USDT',
  mode: 'SANDBOX',
  buyThreshold: 72,
  sellThreshold: 68,
  stopLossPct: 0.03,
  takeProfitPct: 0.05,
  minProfitPct: 0.003,
  maxTradePct: 0.1,
  maxConcurrentPositions: 3,
  intervalMode: 'AGENT',
  minIntervalMinutes: 60,
  orderPriceOffsetPct: 0,
  riskProfile: 'MODERATE',
});

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewAgentStepperModal onClose={vi.fn()} onCreated={vi.fn()} />
    </QueryClientProvider>,
  );
}

type StepperStep =
  | 'identity'
  | 'thresholds'
  | 'risk'
  | 'timing'
  | 'advanced'
  | 'review';

function advanceThrough(...steps: readonly StepperStep[]) {
  steps.forEach(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  });
}

function nameInput() {
  return screen.getByRole('textbox');
}

describe('NewAgentStepperModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({});
  });

  it('emits the same POST body as before this cycle when the advanced step is never touched (CA-002)', async () => {
    renderModal();

    advanceThrough('identity');
    fireEvent.change(nameInput(), { target: { value: 'Mi bot' } });

    advanceThrough('thresholds', 'risk', 'timing', 'advanced', 'review');

    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });
    expect(api.post).toHaveBeenCalledWith(
      '/trading/config',
      POST_BODY_BEFORE_CYCLE,
    );
  });

  it('adds exactly the toggled key to the POST body when one advanced switch is turned on', async () => {
    renderModal();

    advanceThrough('identity');
    fireEvent.change(nameInput(), { target: { value: 'Mi bot' } });

    advanceThrough('thresholds', 'risk', 'timing', 'advanced');

    fireEvent.click(screen.getByRole('button', { name: /Protection/ }));
    fireEvent.click(
      screen.getByRole('switch', { name: 'Native OCO protection' }),
    );

    advanceThrough('review');
    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });
    expect(api.post).toHaveBeenCalledWith('/trading/config', {
      ...POST_BODY_BEFORE_CYCLE,
      nativeProtectionEnabled: true,
    });
  });
});
