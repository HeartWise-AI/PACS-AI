import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { deepRVResultFixtures } from './deepRVFixtures';
import { DeepRVResult } from './DeepRVResult';

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

describe('DeepRVResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('presents normal status and a localized probability', () => {
    act(() => {
      renderer = TestRenderer.create(<DeepRVResult payload={deepRVResultFixtures.validV1} />);
    });

    expect(textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-diagnosis' }))).toBe(
      'Normal RV systolic function'
    );
    expect(textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-probability' }))).toBe(
      '18.4%'
    );
  });

  test('presents the reduced state using explicit text', () => {
    const payload = {
      ...deepRVResultFixtures.validV1,
      predictions: { probability: 0.782, class: 1 as const },
    };

    act(() => {
      renderer = TestRenderer.create(<DeepRVResult payload={payload} />);
    });

    expect(textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-diagnosis' }))).toBe(
      'Reduced RV systolic function'
    );
    expect(textContent(renderer!.root.findByProps({ 'data-testid': 'deeprv-probability' }))).toBe(
      '78.2%'
    );
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

    act(() => {
      renderer = TestRenderer.create(<DeepRVResult payload={payload} />);
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
      renderer = TestRenderer.create(<DeepRVResult payload={deepRVResultFixtures.validV1} />);
    });

    expect(renderer!.root.findAllByType('dl')).toHaveLength(1);
    expect(renderer!.root.findAllByType('dt')).toHaveLength(2);
    expect(renderer!.root.findAllByType('dd')).toHaveLength(2);
    expect(renderer!.root.findByProps({ 'data-testid': 'deeprv-assistive-note' }).props.role).toBe(
      'note'
    );
  });
});
