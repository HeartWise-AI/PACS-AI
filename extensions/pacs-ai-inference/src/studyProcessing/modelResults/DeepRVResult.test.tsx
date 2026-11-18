import React from 'react';
import { render, screen } from '@testing-library/react';
import { deepRVResultFixtures } from './deepRVFixtures';
import { DeepRVResult } from './DeepRVResult';

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

describe('DeepRVResult', () => {
  test('presents normal status and a localized probability', () => {
    render(<DeepRVResult payload={deepRVResultFixtures.validV1} />);

    expect(screen.getByTestId('deeprv-diagnosis').textContent).toBe('Normal RV systolic function');
    expect(screen.getByTestId('deeprv-probability').textContent).toBe('18.4%');
  });

  test('presents the reduced state using explicit text', () => {
    const payload = {
      ...deepRVResultFixtures.validV1,
      predictions: { probability: 0.782, class: 1 as const },
    };

    render(<DeepRVResult payload={payload} />);

    expect(screen.getByTestId('deeprv-diagnosis').textContent).toBe('Reduced RV systolic function');
    expect(screen.getByTestId('deeprv-probability').textContent).toBe('78.2%');
  });

  test('does not display model-authored diagnosis or recommendation strings', () => {
    const payload = {
      ...deepRVResultFixtures.validV1,
      diagnosis: '<img src=x onerror=alert(1)>',
      modelRecommendations: {
        en: '<script>alert(1)</script>',
        fr: '<strong>unsafe model markup</strong>',
        presentable: true,
      },
    };

    const { container } = render(<DeepRVResult payload={payload} />);

    const rendered = renderedContent(container);
    expect(rendered).not.toContain(payload.diagnosis);
    expect(rendered).not.toContain(payload.modelRecommendations.en);
    expect(rendered).not.toContain(payload.modelRecommendations.fr);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('script')).toHaveLength(0);
  });

  test('uses description-list semantics and exposes the assistive note', () => {
    const { container } = render(<DeepRVResult payload={deepRVResultFixtures.validV1} />);

    expect(container.querySelectorAll('dl')).toHaveLength(1);
    expect(container.querySelectorAll('dt')).toHaveLength(2);
    expect(container.querySelectorAll('dd')).toHaveLength(2);
    expect(screen.getByTestId('deeprv-assistive-note').getAttribute('role')).toBe('note');
  });
});
