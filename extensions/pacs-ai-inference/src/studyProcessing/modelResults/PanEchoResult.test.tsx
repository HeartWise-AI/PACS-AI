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

describe('PanEcho aortic stenosis screening', () => {
  const asPayload = {
    diagnosis: JSON.stringify({
      'Aortic valve stenosis': 'None',
      'Aortic valve peak velocity': '2.4 m/s (Normal)',
      'Left ventricular (LV) ejection fraction': '60.0 % (Normal)',
    }),
    predictions: {
      'Aortic valve stenosis': [0.37, 0.43, 0.2],
      'Aortic valve peak velocity': 2.4,
      'Left ventricular (LV) ejection fraction': 60,
    },
  };

  test.each(['1.1.1', '1.2.0'])('PanEcho %s has a structured template', version => {
    const { resolveModelResultRenderer } = jest.requireActual('./modelResultRendererRegistry');
    expect(
      resolveModelResultRenderer({ modelName: 'PanEcho', modelVersion: version, result: asPayload })
        .kind
    ).toBe('panecho');
  });

  test('shows screening scores and the Vmax estimate instead of the argmax class', () => {
    const payload = parsePanEchoResultPayload(asPayload)!;
    const { container } = render(
      <PanEchoResult
        payload={payload}
        modelName="PanEcho"
        modelVersion="1.1.1"
        status="completed"
      />
    );
    const screening = container.querySelector('[data-testid="panecho-as-screening"]')!;

    expect(container.querySelector('[data-testid="panecho-as-severe"]')?.textContent).toContain(
      '20 %'
    );
    expect(container.querySelector('[data-testid="panecho-as-any"]')?.textContent).toContain(
      '57 %'
    );
    expect(
      container.querySelector('[data-testid="panecho-av-vmax-estimate"]')?.textContent
    ).toContain('AI estimate');
    expect(
      container.querySelector('[data-testid="panecho-av-vmax-estimate"]')?.textContent
    ).toContain('2.4 m/s');
    expect(screening.textContent).toContain('Screening scores, not a diagnosis');
    expect(screening.textContent).toContain('under-estimates severe AS');
    // The argmax label is never shown as a finding.
    expect(
      container.querySelector('[data-testid="panecho-output-Aortic valve stenosis"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="panecho-output-Aortic valve peak velocity"]')
    ).toBeNull();
    expect(
      container.querySelector(
        '[data-testid="panecho-output-Left ventricular (LV) ejection fraction"]'
      )
    ).not.toBeNull();
  });
});
