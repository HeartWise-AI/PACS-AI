import React from 'react';
import { render } from '@testing-library/react';
import { parseEchoPrimeResultPayload } from './echoPrimeContract';
import { echoPrimeResultFixtures } from './echoPrimeFixtures';
import { EchoPrimeResult } from './EchoPrimeResult';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
  }),
}));

// Rendered text plus every attribute value (what the serialized render tree exposed).
function renderedContent(container: HTMLElement): string {
  const attributeValues = Array.from(container.querySelectorAll('*')).flatMap(element =>
    Array.from(element.attributes, attribute => attribute.value)
  );
  return [container.textContent ?? '', ...attributeValues].join('\n');
}

describe('EchoPrimeResult', () => {
  test.each(['successfulV1', 'partialV1'] as const)(
    'renders responsive structured output for the %s fixture',
    fixture => {
      const payload = parseEchoPrimeResultPayload(echoPrimeResultFixtures[fixture])!;
      const { container } = render(
        <EchoPrimeResult
          payload={payload}
          modelName="EchoPrime"
          modelVersion="1.2.0"
          status="completed"
        />
      );

      expect(container.querySelectorAll('[data-testid="echoprime-result"]')).toHaveLength(1);
      expect(container.querySelectorAll('dl').length).toBeGreaterThan(0);
      expect(renderedContent(container)).toContain('Completed');
    }
  );

  test('shows report sections, units, threshold classifications, and null-safe values', () => {
    const payload = parseEchoPrimeResultPayload(echoPrimeResultFixtures.successfulV1)!;
    const { container } = render(
      <EchoPrimeResult
        payload={payload}
        modelName="EchoPrime"
        modelVersion="1.2.0"
        status="completed"
      />
    );

    const rendered = renderedContent(container);
    expect(rendered).toContain('Left Ventricle');
    expect(rendered).toContain('59.0 %');
    expect(rendered).toContain('22.5 mmHg');
    expect(rendered).toContain('Detected');
    expect(rendered).toContain('Not detected');
  });

  test('renders unknown and nested partial fields without throwing', () => {
    const payload = parseEchoPrimeResultPayload(echoPrimeResultFixtures.partialV1)!;
    const { container } = render(
      <EchoPrimeResult
        payload={payload}
        modelName="EchoPrime"
        modelVersion="1.2.0"
        status="completed"
      />
    );

    const rendered = renderedContent(container);
    expect(rendered).toContain('Future echo metric');
    expect(rendered).toContain('44.0%');
    expect(rendered).toContain('Unknown nested value');
  });
});
