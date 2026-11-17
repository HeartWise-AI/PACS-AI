import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { DeepRVClipResult } from './DeepRVClipResult';
import { deepRVClipResultFixtures } from './deepRVClipFixtures';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
    i18n: { language: 'en-US' },
  }),
}));

function textContent(instance: ReactTestInstance): string {
  return instance.children
    .map(child => (typeof child === 'string' ? child : textContent(child)))
    .join('');
}

describe('DeepRVClipResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('presents normal status, probability, and threshold as localized percentages', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepRVClipResult payload={deepRVClipResultFixtures.validV1} />
      );
    });

    expect(
      textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-clip-diagnosis' }))
    ).toBe('Normal RV systolic function');
    expect(
      textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-clip-probability' }))
    ).toBe('12.4%');
    expect(
      textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-clip-threshold' }))
    ).toBe('50.0%');
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

    act(() => {
      renderer = TestRenderer.create(<DeepRVClipResult payload={payload} />);
    });

    expect(
      textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-clip-diagnosis' }))
    ).toBe('Possible RV systolic dysfunction');
    expect(
      textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-clip-probability' }))
    ).toBe('83.6%');
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

    act(() => {
      renderer = TestRenderer.create(<DeepRVClipResult payload={payload} />);
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).not.toContain(payload.diagnosis);
    expect(rendered).not.toContain(payload.modelRecommendations.en);
    expect(rendered).not.toContain(payload.modelRecommendations.fr);
    expect(renderer!.root.findAllByType('img')).toHaveLength(0);
    expect(renderer!.root.findAllByType('script')).toHaveLength(0);
  });

  test('uses description-list semantics and exposes the assistive note', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepRVClipResult payload={deepRVClipResultFixtures.validV1} />
      );
    });

    expect(renderer!.root.findAllByType('dl')).toHaveLength(1);
    expect(renderer!.root.findAllByType('dt')).toHaveLength(3);
    expect(renderer!.root.findAllByType('dd')).toHaveLength(3);
    expect(
      renderer!.root.findByProps({ 'data-testid': 'deeprv-clip-assistive-note' }).props.role
    ).toBe('note');
  });
});
