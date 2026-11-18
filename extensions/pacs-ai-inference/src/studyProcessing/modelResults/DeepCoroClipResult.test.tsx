import React from 'react';
import { render, screen } from '@testing-library/react';
import { DEEP_CORO_CLIP_ARTERIES } from './deepCoroClipContract';
import { deepCoroClipResultFixtures } from './deepCoroClipFixtures';
import { DeepCoroClipResult } from './DeepCoroClipResult';

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

describe('DeepCoroClipResult', () => {
  test('presents all documented vessels in the three model-defined groups', () => {
    const { container } = render(
      <DeepCoroClipResult payload={deepCoroClipResultFixtures.validV1} />
    );

    expect(container.querySelectorAll('table')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="deepcoro-clip-group-rca"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="deepcoro-clip-group-lca"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="deepcoro-clip-group-other"]')).toHaveLength(1);
    for (const artery of DEEP_CORO_CLIP_ARTERIES) {
      expect(
        container.querySelectorAll(`[data-testid="deepcoro-clip-artery-${artery}"]`)
      ).toHaveLength(1);
    }
  });

  test('formats estimates and probabilities as one-decimal percentages', () => {
    render(<DeepCoroClipResult payload={deepCoroClipResultFixtures.validV1} />);

    const proximalRca = screen.getByTestId('deepcoro-clip-artery-Proximal RCA').textContent;
    expect(proximalRca).toContain('Blocked');
    expect(proximalRca).toContain('62.4%');
    expect(proximalRca).toContain('82.0%');
    expect(proximalRca).toContain('Calcified');
    expect(proximalRca).toContain('73.0%');

    const midLad = screen.getByTestId('deepcoro-clip-artery-Mid LAD').textContent;
    expect(midLad).toContain('CTO');
    expect(midLad).toContain('71.0%');
  });

  test('does not display model-authored diagnosis or recommendation strings', () => {
    const payload = {
      ...deepCoroClipResultFixtures.validV1,
      diagnosis: '<img src=x onerror=alert(1)>',
      modelRecommendations: {
        ...deepCoroClipResultFixtures.validV1.modelRecommendations,
        en: '<script>alert(1)</script>',
        fr: '<strong>unsafe model markup</strong>',
      },
    };

    const { container } = render(<DeepCoroClipResult payload={payload} />);

    const rendered = renderedContent(container);
    expect(rendered).not.toContain(payload.diagnosis);
    expect(rendered).not.toContain(payload.modelRecommendations.en);
    expect(rendered).not.toContain(payload.modelRecommendations.fr);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('script')).toHaveLength(0);
  });

  test('uses table semantics and exposes an assistive note', () => {
    const { container } = render(
      <DeepCoroClipResult payload={deepCoroClipResultFixtures.validV1} />
    );

    expect(container.querySelectorAll('caption')).toHaveLength(3);
    expect(container.querySelectorAll('[scope="row"]')).toHaveLength(
      DEEP_CORO_CLIP_ARTERIES.length
    );
    expect(screen.getByTestId('deepcoro-clip-assistive-note').getAttribute('role')).toBe('note');
  });
});
