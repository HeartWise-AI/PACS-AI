import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import {
  DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS,
  DEEP_CORO_MACE_PRIMARY_ENDPOINTS,
} from './deepCoroMaceContract';
import { deepCoroMaceResultFixtures } from './deepCoroMaceFixtures';
import { DeepCoroMaceResult } from './DeepCoroMaceResult';

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

describe('DeepCoroMaceResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('presents every documented endpoint in primary and exploratory tables', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroMaceResult payload={deepCoroMaceResultFixtures.parsedV1} />
      );
    });

    expect(renderer!.root.findAllByType('table')).toHaveLength(2);
    for (const key of [
      ...DEEP_CORO_MACE_PRIMARY_ENDPOINTS,
      ...DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS,
    ]) {
      expect(
        renderer!.root.findAllByProps({ 'data-testid': `deepcoro-mace-endpoint-${key}` })
      ).toHaveLength(1);
    }
  });

  test('formats scores, thresholds, and threshold states', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroMaceResult payload={deepCoroMaceResultFixtures.parsedV1} />
      );
    });

    const composite = textContent(
      renderer!.root.findByProps({ 'data-testid': 'deepcoro-mace-endpoint-compositeMace' })
    );
    expect(composite).toContain('62.4%');
    expect(composite).toContain('50.0%');
    expect(composite).toContain('At or above threshold');

    const revascularization = textContent(
      renderer!.root.findByProps({
        'data-testid': 'deepcoro-mace-endpoint-urgentRevascularization',
      })
    );
    expect(revascularization).toContain('38.2%');
    expect(revascularization).toContain('Below threshold');
  });

  test('uses fixed cautions instead of model-authored strings or markup', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroMaceResult payload={deepCoroMaceResultFixtures.parsedV1} />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('Research use only');
    expect(rendered).toContain('very few cardiovascular deaths');
    expect(rendered).not.toContain(deepCoroMaceResultFixtures.parsedV1.diagnosis);
    expect(rendered).not.toContain(deepCoroMaceResultFixtures.parsedV1.predictions.thresholdNote);
    expect(rendered).not.toContain(deepCoroMaceResultFixtures.parsedV1.modelRecommendations.en);
    expect(renderer!.root.findAllByType('strong')).toHaveLength(0);
  });

  test('uses table semantics and exposes the research caution as a note', () => {
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroMaceResult payload={deepCoroMaceResultFixtures.parsedV1} />
      );
    });

    expect(renderer!.root.findAllByType('caption')).toHaveLength(2);
    expect(renderer!.root.findAllByProps({ scope: 'row' })).toHaveLength(9);
    expect(
      renderer!.root.findByProps({ 'data-testid': 'deepcoro-mace-research-note' }).props.role
    ).toBe('note');
  });
});
