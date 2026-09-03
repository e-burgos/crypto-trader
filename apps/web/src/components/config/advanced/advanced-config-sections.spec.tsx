import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TradingModeWire } from '@crypto-trader/shared';
import '../../../lib/i18n';
import { AdvancedConfigSections } from './advanced-config-sections';
import { DEFAULT_ADVANCED_DRAFT } from './advanced-draft';
import { useAdvancedDraft } from './use-advanced-draft';

function Harness({
  resolvedMode = 'SANDBOX',
  surface = 'create',
}: {
  resolvedMode?: TradingModeWire;
  surface?: 'create' | 'edit';
}) {
  const { draft, setField } = useAdvancedDraft(DEFAULT_ADVANCED_DRAFT);
  return (
    <AdvancedConfigSections
      draft={draft}
      onChange={setField}
      resolvedMode={resolvedMode}
      surface={surface}
    />
  );
}

function openProtection() {
  fireEvent.click(screen.getByRole('button', { name: /Protection/ }));
}

function openSignal() {
  fireEvent.click(screen.getByRole('button', { name: /Signal & sizing/ }));
}

function openReactive() {
  fireEvent.click(screen.getByRole('button', { name: /Reactive loop/ }));
}

function openEntry() {
  fireEvent.click(screen.getByRole('button', { name: /^Entry/ }));
}

describe('AdvancedConfigSections — Protection', () => {
  it('renders every root switch off from DEFAULT_ADVANCED_DRAFT', () => {
    render(<Harness />);
    openProtection();

    expect(screen.getByRole('switch', { name: 'Native OCO protection' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('switch', { name: 'Trailing stop' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('switch', { name: 'Partial take-profit' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('shows moveStopToBreakevenAfterPartial checked yet disabled while partialTpEnabled is off', () => {
    render(<Harness />);
    openProtection();

    const moveToBreakeven = screen.getByRole('switch', { name: 'Move stop to breakeven' });
    expect(moveToBreakeven).toHaveAttribute('aria-checked', 'true');
    expect(moveToBreakeven).toBeDisabled();
  });

  it('keeps dependent params disabled until their switch is on, then enables them', () => {
    render(<Harness />);
    openProtection();

    expect(screen.getByRole('slider', { name: 'Stop-limit offset' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Close if protection fails' })).toBeDisabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Native OCO protection' }));

    expect(screen.getByRole('slider', { name: 'Stop-limit offset' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Close if protection fails' })).toBeEnabled();
  });

  it('shows "No limit" with maxPositionHoldEnabled off, and the slider once turned on', () => {
    render(<Harness />);
    openProtection();

    expect(screen.getByText('No limit')).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Maximum time in position' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Time limit in position' }));

    expect(screen.getByRole('slider', { name: 'Maximum time in position' })).toBeEnabled();
    expect(screen.queryByText('No limit')).not.toBeInTheDocument();
  });

  it('never renders a raw i18n key literal', () => {
    render(<Harness />);
    openProtection();

    expect(document.body.textContent).not.toMatch(/config\.advanced/);
  });
});

describe('AdvancedConfigSections — Signal & sizing', () => {
  it('keeps lossCut params disabled until lossCutEnabled is on', () => {
    render(<Harness />);
    openSignal();

    expect(screen.getByRole('slider', { name: 'Minimum confidence to cut' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Minimum loss to cut' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Minimum edge ratio' })).toBeDisabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Signal loss cut' }));

    expect(screen.getByRole('slider', { name: 'Minimum confidence to cut' })).toBeEnabled();
    expect(screen.getByRole('slider', { name: 'Minimum loss to cut' })).toBeEnabled();
    expect(screen.getByRole('slider', { name: 'Minimum edge ratio' })).toBeEnabled();
  });

  it('keeps reduceSizeFactor disabled until smartSizingEnabled is on', () => {
    render(<Harness />);
    openSignal();

    expect(screen.getByRole('slider', { name: 'Reduction factor' })).toBeDisabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Smart sizing' }));

    expect(screen.getByRole('slider', { name: 'Reduction factor' })).toBeEnabled();
  });

  it('keeps gatePriceChangePct disabled until deterministicGateEnabled is on, and independent of lossCut', () => {
    render(<Harness />);
    openSignal();

    expect(screen.getByRole('slider', { name: 'Price change threshold' })).toBeDisabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Signal loss cut' }));
    expect(screen.getByRole('slider', { name: 'Price change threshold' })).toBeDisabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Deterministic gate' }));
    expect(screen.getByRole('slider', { name: 'Price change threshold' })).toBeEnabled();
  });
});

describe('AdvancedConfigSections — Reactive loop', () => {
  it('keeps the frequency caps disabled until reactiveLoopEnabled is on', () => {
    render(<Harness />);
    openReactive();

    expect(screen.getByRole('slider', { name: 'Maximum actions per hour' })).toBeDisabled();
    expect(
      screen.getByRole('slider', { name: 'Minimum interval between actions' }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Reactive loop' }));

    expect(screen.getByRole('slider', { name: 'Maximum actions per hour' })).toBeEnabled();
    expect(
      screen.getByRole('slider', { name: 'Minimum interval between actions' }),
    ).toBeEnabled();
  });

  it('exposes exactly the DTO ranges for the frequency caps', () => {
    render(<Harness />);
    openReactive();

    const maxActionsPerHour = screen.getByRole('slider', { name: 'Maximum actions per hour' });
    expect(maxActionsPerHour).toHaveAttribute('min', '1');
    expect(maxActionsPerHour).toHaveAttribute('max', '60');
    expect(maxActionsPerHour).toHaveAttribute('step', '1');

    const minActionIntervalSec = screen.getByRole('slider', {
      name: 'Minimum interval between actions',
    });
    expect(minActionIntervalSec).toHaveAttribute('min', '5');
    expect(minActionIntervalSec).toHaveAttribute('max', '3600');
    expect(minActionIntervalSec).toHaveAttribute('step', '5');
  });
});

describe('AdvancedConfigSections — Entry', () => {
  it('offers the three entryOrderMode options with their descriptions in TESTNET', () => {
    render(<Harness resolvedMode="TESTNET" />);
    openEntry();

    fireEvent.click(screen.getByRole('button', { name: 'Market' }));

    expect(screen.getByText('Limit (resting)')).toBeInTheDocument();
    expect(
      screen.getByText('The entry rests at the support level until it fills or expires.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Support + breakout (OCO)')).toBeInTheDocument();
    expect(
      screen.getByText('Places support and breakout at once: enters through whichever fills first.'),
    ).toBeInTheDocument();
  });

  it('disables entryOrderMode in SANDBOX and shows the visible sandbox explanation', () => {
    render(<Harness resolvedMode="SANDBOX" />);
    openEntry();

    expect(screen.getByRole('button', { name: 'Market' })).toBeDisabled();
    expect(
      screen.getByText(
        "Resting entries don't apply in SANDBOX: the bot buys at a simulated market price.",
      ),
    ).toBeInTheDocument();
  });

  it('enables entryOrderMode outside SANDBOX without the sandbox explanation', () => {
    render(<Harness resolvedMode="TESTNET" />);
    openEntry();

    expect(screen.getByRole('button', { name: 'Market' })).toBeEnabled();
    expect(
      screen.queryByText(
        "Resting entries don't apply in SANDBOX: the bot buys at a simulated market price.",
      ),
    ).not.toBeInTheDocument();
  });

  it('enables entryOrderTtlMinutes only once entryOrderMode leaves MARKET, with the DTO range', () => {
    render(<Harness resolvedMode="TESTNET" />);
    openEntry();

    expect(screen.getByRole('slider', { name: 'Entry expiration' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Market' }));
    fireEvent.click(screen.getByRole('button', { name: /^Limit \(resting\)/ }));

    const ttl = screen.getByRole('slider', { name: 'Entry expiration' });
    expect(ttl).toBeEnabled();
    expect(ttl).toHaveAttribute('min', '5');
    expect(ttl).toHaveAttribute('max', '1440');
    expect(ttl).toHaveAttribute('step', '5');
  });

  it('shows "Fixed level" and a disabled toggle while entryOrderMode is not OCO', () => {
    render(<Harness resolvedMode="TESTNET" />);
    openEntry();

    expect(screen.getByText('Fixed level')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Trailing on breakout' })).toBeDisabled();
  });

  it('enables entryTrailingDeltaBips only with OCO and its synthetic switch on', () => {
    render(<Harness resolvedMode="TESTNET" />);
    openEntry();

    fireEvent.click(screen.getByRole('button', { name: 'Market' }));
    fireEvent.click(screen.getByRole('button', { name: /Support \+ breakout/ }));

    const trailingToggle = screen.getByRole('switch', { name: 'Trailing on breakout' });
    expect(trailingToggle).toBeEnabled();
    expect(screen.getByText('Fixed level')).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Breakout trailing' })).not.toBeInTheDocument();

    fireEvent.click(trailingToggle);

    const trailingSlider = screen.getByRole('slider', { name: 'Breakout trailing' });
    expect(trailingSlider).toBeEnabled();
    expect(trailingSlider).toHaveAttribute('min', '10');
    expect(trailingSlider).toHaveAttribute('max', '2000');
    expect(trailingSlider).toHaveAttribute('step', '10');
  });
});
