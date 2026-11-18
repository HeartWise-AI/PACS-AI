import React from 'react';
import { render } from '@testing-library/react';
import { PanEchoResult } from './PanEchoResult';
import { parsePanEchoResultPayload } from './panEchoContract';
import { panEchoResultFixtures } from './panEchoFixtures';

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

describe('PanEchoResult', () => {
  test.each(['successfulV1', 'partialV1'] as const)(
    'renders responsive structured output for the %s fixture',
    fixture => {
      const payload = parsePanEchoResultPayload(panEchoResultFixtures[fixture])!;
      const { container } = render(
        <PanEchoResult
          payload={payload}
          modelName="PanEcho"
          modelVersion="1.0.0"
          status="completed"
        />
      );

      expect(container.querySelectorAll('[data-testid="panecho-result"]')).toHaveLength(1);
      expect(container.querySelectorAll('dl').length).toBeGreaterThan(1);
      expect(renderedContent(container)).toContain('Completed');
    }
  );

  test('shows documented values, units, classifications, and unknown outputs', () => {
    const payload = parsePanEchoResultPayload(panEchoResultFixtures.partialV1)!;
    const { container } = render(
      <PanEchoResult
        payload={payload}
        modelName="PanEcho"
        modelVersion="1.4.0"
        status="completed"
      />
    );

    const rendered = renderedContent(container);
    expect(rendered).toContain('37.6 %');
    expect(rendered).toContain('Moderately Abnormal');
    expect(rendered).toContain('Future echo measurement');
    expect(rendered).toContain('Future echo classification');
  });
});
