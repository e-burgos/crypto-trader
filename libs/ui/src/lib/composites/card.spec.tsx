import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from './card';

describe('Card', () => {
  it('propagates data-testid, aria-label and id to the root element', () => {
    render(
      <Card
        title="Coinalyze"
        data-testid="data-source-card"
        aria-label="Coinalyze data source"
        id="card-coinalyze"
      />,
    );

    const root = screen.getByTestId('data-source-card');
    expect(root).toHaveAttribute('aria-label', 'Coinalyze data source');
    expect(root).toHaveAttribute('id', 'card-coinalyze');
  });

  it('renders title as the heading, not as the HTML title attribute', () => {
    render(<Card title="Coinalyze" data-testid="data-source-card" />);

    const root = screen.getByTestId('data-source-card');
    expect(root).not.toHaveAttribute('title');
    expect(screen.getByRole('heading', { name: 'Coinalyze' })).toBeInTheDocument();
  });
});
