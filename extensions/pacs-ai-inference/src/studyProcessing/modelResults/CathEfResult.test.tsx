import React from 'react';
import { render, screen } from '@testing-library/react';
import { cathEfResultFixtures } from './cathEfFixtures';
import { CathEfResult } from './CathEfResult';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
    i18n: { language: 'en-US' },
  }),
}));

// Rendered text plus every attribute value (what the serialized render tree exposed).
function renderedContent(container: HTMLElement): string {
  const attributeValues = Array.from(container.querySelectorAll('*')).flatMap(element =>
    Array.from(element.attributes, attribute => attribute.value)
  );
  return [container.textContent ?? '', ...attributeValues].join('\n');
}

describe('CathEfResult', () => {
  test('keeps vessel classification and LVEF aligned by series', () => {
    render(<CathEfResult payload={cathEfResultFixtures.withLvefV1} />);

    expect(screen.getByTestId('cathef-series-1').textContent).toContain('48.3%');
    expect(screen.getByTestId('cathef-series-7').textContent).toContain('56.8%');
    const rightCoronary = screen.getByTestId('cathef-series-2').textContent;
    expect(rightCoronary).toContain('Right coronary');
    expect(rightCoronary).toContain('Not available');
  });

  test('renders a valid vessel-only payload without inventing LVEF estimates', () => {
    const { container } = render(<CathEfResult payload={cathEfResultFixtures.vesselOnlyV1} />);

    const rendered = renderedContent(container);
    expect(rendered).toContain('Aorta');
    expect(rendered).toContain('Catheter');
    expect(rendered.match(/Not available/g)).toHaveLength(2);
  });

  test('does not display or interpret model-authored recommendation markup', () => {
    const { container } = render(<CathEfResult payload={cathEfResultFixtures.withLvefV1} />);

    const rendered = renderedContent(container);
    expect(rendered).not.toContain(cathEfResultFixtures.withLvefV1.modelRecommendations.en);
    expect(rendered).not.toContain(cathEfResultFixtures.withLvefV1.modelRecommendations.fr);
    expect(container.querySelectorAll('strong')).toHaveLength(0);
  });

  test('uses table semantics and exposes an assistive note', () => {
    const { container } = render(<CathEfResult payload={cathEfResultFixtures.withLvefV1} />);

    expect(container.querySelectorAll('caption')).toHaveLength(1);
    expect(container.querySelectorAll('[scope="row"]')).toHaveLength(3);
    expect(screen.getByTestId('cathef-assistive-note').getAttribute('role')).toBe('note');
  });
});
