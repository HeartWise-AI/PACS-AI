import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { DEEP_CORO_CLIP_ARTERIES } from './deepCoroClipContract';
import { deepCoroClipResultFixtures } from './deepCoroClipFixtures';
import { DeepCoroClipResult } from './DeepCoroClipResult';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
  }),
}));

function textContent(instance: ReactTestInstance): string {
  return instance.children
    .map(child => (typeof child === 'string' ? child : textContent(child)))
    .join('');
}

describe('DeepCoroClipResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('presents all documented vessels in the three model-defined groups', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroClipResult payload={deepCoroClipResultFixtures.validV1} />
      );
    });

    expect(renderer!.root.findAllByType('table')).toHaveLength(3);
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-clip-group-rca' })
    ).toHaveLength(1);
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-clip-group-lca' })
    ).toHaveLength(1);
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'deepcoro-clip-group-other' })
    ).toHaveLength(1);
    for (const artery of DEEP_CORO_CLIP_ARTERIES) {
      expect(
        renderer!.root.findAllByProps({ 'data-testid': `deepcoro-clip-artery-${artery}` })
      ).toHaveLength(1);
    }
  });

  test('formats estimates and probabilities as one-decimal percentages', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroClipResult payload={deepCoroClipResultFixtures.validV1} />
      );
    });

    const proximalRca = textContent(
      renderer!.root.findByProps({ 'data-testid': 'deepcoro-clip-artery-Proximal RCA' })
    );
    expect(proximalRca).toContain('Blocked');
    expect(proximalRca).toContain('62.4%');
    expect(proximalRca).toContain('82.0%');
    expect(proximalRca).toContain('Calcified');
    expect(proximalRca).toContain('73.0%');

    const midLad = textContent(
      renderer!.root.findByProps({ 'data-testid': 'deepcoro-clip-artery-Mid LAD' })
    );
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

    act(() => {
      renderer = TestRenderer.create(<DeepCoroClipResult payload={payload} />);
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).not.toContain(payload.diagnosis);
    expect(rendered).not.toContain(payload.modelRecommendations.en);
    expect(rendered).not.toContain(payload.modelRecommendations.fr);
    expect(renderer!.root.findAllByType('img')).toHaveLength(0);
    expect(renderer!.root.findAllByType('script')).toHaveLength(0);
  });

  test('uses table semantics and exposes an assistive note', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroClipResult payload={deepCoroClipResultFixtures.validV1} />
      );
    });

    expect(renderer!.root.findAllByType('caption')).toHaveLength(3);
    expect(renderer!.root.findAllByProps({ scope: 'row' })).toHaveLength(
      DEEP_CORO_CLIP_ARTERIES.length
    );
    expect(
      renderer!.root.findByProps({ 'data-testid': 'deepcoro-clip-assistive-note' }).props.role
    ).toBe('note');
  });
});
