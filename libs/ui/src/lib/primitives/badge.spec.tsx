import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders the info variant with its label and no spin animation', () => {
    render(<Badge variant="info" label="Resting" />);

    const badge = screen.getByText('Resting');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('span')).toHaveClass('bg-sky-500/10');
    expect(badge.closest('span')?.querySelector('.animate-spin')).toBeNull();
  });

  it('keeps info visually distinct from neutral and loading', () => {
    const { rerender } = render(<Badge variant="info" label="Resting" />);
    const infoClass = screen.getByText('Resting').closest('span')?.className;

    rerender(<Badge variant="neutral" label="Resting" />);
    const neutralClass = screen.getByText('Resting').closest('span')?.className;

    rerender(<Badge variant="loading" label="Resting" />);
    const loadingClass = screen.getByText('Resting').closest('span')?.className;

    expect(infoClass).not.toBe(neutralClass);
    expect(infoClass).not.toBe(loadingClass);
  });
});
