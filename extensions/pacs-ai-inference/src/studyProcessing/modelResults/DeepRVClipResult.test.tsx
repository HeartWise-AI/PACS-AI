import React from 'react';
import { render, screen } from '@testing-library/react';
import { DeepRVClipResult } from './DeepRVClipResult';
import { deepRVClipResultFixtures } from './deepRVClipFixtures';

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

describe('DeepRVClipResult', () => {
  test('presents normal status, probability, and threshold as localized percentages', () => {
    render(<DeepRVClipResult payload={deepRVClipResultFixtures.validV1} />);

    expect(screen.getByTestId('deeprv-clip-diagnosis').textContent).toBe(
      'Normal RV systolic function'
    );
    expect(screen.getByTestId('deeprv-clip-probability').textContent).toBe('12.4%');
    expect(screen.getByTestId('deeprv-clip-threshold').textContent).toBe('50.0%');
  });

  test('presents the abnormal state using explicit text', () => {
    const payload = {
      ...deepRVClipResultFixtures.validV1,
      predictions: {
        abnormalRV: {
          ...deepRVClipResultFixtures.validV1.predictions.abnormalRV,
          probability: 0.836,
          diagnosis: 'abnormal' as const,
        },
      },
    };

    render(<DeepRVClipResult payload={payload} />);

    expect(screen.getByTestId('deeprv-clip-diagnosis').textContent).toBe(
      'Possible RV systolic dysfunction'
    );
    expect(screen.getByTestId('deeprv-clip-probability').textContent).toBe('83.6%');
  });

  test('does not display model-authored diagnosis or recommendation strings', () => {
    const payload = {
      ...deepRVClipResultFixtures.validV1,
      diagnosis: '<img src=x onerror=alert(1)>',
      modelRecommendations: {
        en: '<script>alert(1)</script>',
        fr: '<strong>unsafe model markup</strong>',
        presentable: true,
      },
    };

    const { container } = render(<DeepRVClipResult payload={payload} />);

    const rendered = renderedContent(container);
    expect(rendered).not.toContain(payload.diagnosis);
    expect(rendered).not.toContain(payload.modelRecommendations.en);
    expect(rendered).not.toContain(payload.modelRecommendations.fr);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('script')).toHaveLength(0);
  });

  test('uses description-list semantics and exposes the assistive note', () => {
    const { container } = render(<DeepRVClipResult payload={deepRVClipResultFixtures.validV1} />);

    expect(container.querySelectorAll('dl')).toHaveLength(1);
    expect(container.querySelectorAll('dt')).toHaveLength(3);
    expect(container.querySelectorAll('dd')).toHaveLength(3);
    expect(screen.getByTestId('deeprv-clip-assistive-note').getAttribute('role')).toBe('note');
  });
});
