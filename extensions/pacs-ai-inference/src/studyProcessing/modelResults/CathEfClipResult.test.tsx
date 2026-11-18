import React from 'react';
import { render, screen } from '@testing-library/react';
import { cathEfClipResultFixtures } from './cathEfClipFixtures';
import { CathEfClipResult } from './CathEfClipResult';

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

describe('CathEfClipResult', () => {
  test.each([
    ['reducedV1', '37.4%', 'Reduced EF', '78.2%', '50.0%'],
    ['preservedV1', '58.6%', 'Preserved EF', '18.3%', '50.0%'],
  ] as const)(
    'renders the %s estimate and classification',
    (fixture, lvef, label, probability, threshold) => {
      const { container } = render(
        <CathEfClipResult payload={cathEfClipResultFixtures[fixture]} />
      );

      const rendered = renderedContent(container);
      expect(screen.getByTestId('cathef-clip-lvef').textContent).toBe(lvef);
      expect(rendered).toContain(label);
      expect(rendered).toContain(probability);
      expect(rendered).toContain(threshold);
    }
  );

  test('does not display or interpret model-authored diagnosis and recommendation markup', () => {
    const { container } = render(<CathEfClipResult payload={cathEfClipResultFixtures.reducedV1} />);

    const rendered = renderedContent(container);
    expect(rendered).not.toContain(cathEfClipResultFixtures.reducedV1.diagnosis);
    expect(rendered).not.toContain(cathEfClipResultFixtures.reducedV1.modelRecommendations.en);
    expect(rendered).not.toContain(cathEfClipResultFixtures.reducedV1.modelRecommendations.fr);
    expect(container.querySelectorAll('strong')).toHaveLength(0);
  });

  test('uses semantic descriptions and exposes an assistive note', () => {
    const { container } = render(<CathEfClipResult payload={cathEfClipResultFixtures.reducedV1} />);

    expect(container.querySelectorAll('dl')).toHaveLength(1);
    expect(container.querySelectorAll('dt')).toHaveLength(2);
    expect(container.querySelectorAll('dd')).toHaveLength(2);
    expect(screen.getByTestId('cathef-clip-assistive-note').getAttribute('role')).toBe('note');
  });
});
