import React from 'react';
import { render } from '@testing-library/react';
import { DeepCoroCtoResult } from './DeepCoroCtoResult';
import { deepCoroCtoResultFixtures } from './deepCoroCtoFixtures';

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

describe('DeepCoroCtoResult', () => {
  test('presents score, components, and per-artery results', () => {
    const { container } = render(
      <DeepCoroCtoResult payload={deepCoroCtoResultFixtures.parsedV2} />
    );
    expect(container.querySelectorAll('[data-testid="deepcoro-cto-result"]')).toHaveLength(1);
    expect(container.querySelectorAll('table')).toHaveLength(2);
    const rendered = renderedContent(container);
    expect(rendered).toContain('RCA');
    expect(rendered).toContain('71.0%');
    expect(rendered).toContain('difficult');
  });

  test('uses fixed safety text instead of model-authored strings', () => {
    const { container } = render(
      <DeepCoroCtoResult payload={deepCoroCtoResultFixtures.parsedV2} />
    );
    const rendered = renderedContent(container);
    expect(rendered).not.toContain('Synthetic J-CTO result');
    expect(rendered).not.toContain('<strong>');
    expect(container.querySelectorAll('[role="note"]')).toHaveLength(1);
  });

  test('shows a fixed caution for a selected LCx result', () => {
    const { container } = render(
      <DeepCoroCtoResult
        payload={{
          ...deepCoroCtoResultFixtures.parsedV2,
          predictions: { ...deepCoroCtoResultFixtures.parsedV2.predictions, ctoArtery: 'LCx' },
        }}
      />
    );
    expect(container.querySelectorAll('[data-testid="deepcoro-cto-lcx-warning"]')).toHaveLength(1);
  });
});
