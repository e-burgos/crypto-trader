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
