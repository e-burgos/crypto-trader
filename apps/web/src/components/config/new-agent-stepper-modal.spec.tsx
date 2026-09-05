import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  CreateTradingConfigInput,
  TradingConfigAdvancedField,
} from '@crypto-trader/shared';
import '../../lib/i18n';
import { NewAgentStepperModal } from './new-agent-stepper-modal';
import {
  DEFAULT_ADVANCED_DRAFT,
  useAdvancedDraft,
  type UseAdvancedDraftResult,
} from './advanced';

vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const advancedDraftHookRef = vi.hoisted(() => ({
  actual: undefined as unknown,
}));

vi.mock('./advanced', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./advanced')>();
  advancedDraftHookRef.actual = actual.useAdvancedDraft;
  return { ...actual, useAdvancedDraft: vi.fn(actual.useAdvancedDraft) };
});

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
    vi.mocked(useAdvancedDraft).mockImplementation(
      advancedDraftHookRef.actual as typeof useAdvancedDraft,
    );
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

  it('blocks the create submit when an advanced field is out of range (FIX-e-burgos-034)', async () => {
    vi.mocked(useAdvancedDraft).mockReturnValue({
      draft: {
        ...DEFAULT_ADVANCED_DRAFT,
        reactiveLoopEnabled: true,
        minActionIntervalSec: '999999',
      },
      setField: vi.fn(),
      isFieldEnabled: () => true,
      changedFields: new Set<TradingConfigAdvancedField>([
        'reactiveLoopEnabled',
        'minActionIntervalSec',
      ]),
      isWithinRanges: false,
    } satisfies UseAdvancedDraftResult);

    renderModal();

    advanceThrough('identity');
    fireEvent.change(nameInput(), { target: { value: 'Mi bot' } });
    advanceThrough('thresholds', 'risk', 'timing', 'advanced', 'review');

    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits normally when an advanced numeric field is changed to an in-range value (FIX-e-burgos-034)', async () => {
    renderModal();

    advanceThrough('identity');
    fireEvent.change(nameInput(), { target: { value: 'Mi bot' } });

    advanceThrough('thresholds', 'risk', 'timing', 'advanced');

    fireEvent.click(screen.getByRole('button', { name: /Reactive loop/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Reactive loop' }));
    fireEvent.change(
      screen.getByRole('slider', { name: 'Maximum actions per hour' }),
      { target: { value: '30' } },
    );

    advanceThrough('review');
    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });
    expect(api.post).toHaveBeenCalledWith('/trading/config', {
      ...POST_BODY_BEFORE_CYCLE,
      reactiveLoopEnabled: true,
      maxActionsPerHour: 30,
    });
  });
});
