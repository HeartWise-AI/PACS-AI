import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { cathEfResultFixtures } from './cathEfFixtures';
import { CathEfResult } from './CathEfResult';

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

describe('CathEfResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('keeps vessel classification and LVEF aligned by series', () => {
    act(() => {
      renderer = TestRenderer.create(<CathEfResult payload={cathEfResultFixtures.withLvefV1} />);
    });

    expect(textContent(renderer!.root.findByProps({ 'data-testid': 'cathef-series-1' }))).toContain(
      '48.3%'
    );
    expect(textContent(renderer!.root.findByProps({ 'data-testid': 'cathef-series-7' }))).toContain(
      '56.8%'
    );
    const rightCoronary = textContent(
      renderer!.root.findByProps({ 'data-testid': 'cathef-series-2' })
    );
    expect(rightCoronary).toContain('Right coronary');
    expect(rightCoronary).toContain('Not available');
  });

  test('renders a valid vessel-only payload without inventing LVEF estimates', () => {
    act(() => {
      renderer = TestRenderer.create(<CathEfResult payload={cathEfResultFixtures.vesselOnlyV1} />);
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('Aorta');
    expect(rendered).toContain('Catheter');
    expect(rendered.match(/Not available/g)).toHaveLength(2);
  });

  test('does not display or interpret model-authored recommendation markup', () => {
    act(() => {
      renderer = TestRenderer.create(<CathEfResult payload={cathEfResultFixtures.withLvefV1} />);
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).not.toContain(cathEfResultFixtures.withLvefV1.modelRecommendations.en);
    expect(rendered).not.toContain(cathEfResultFixtures.withLvefV1.modelRecommendations.fr);
    expect(renderer!.root.findAllByType('strong')).toHaveLength(0);
  });

  test('uses table semantics and exposes an assistive note', () => {
    act(() => {
      renderer = TestRenderer.create(<CathEfResult payload={cathEfResultFixtures.withLvefV1} />);
    });

    expect(renderer!.root.findAllByType('caption')).toHaveLength(1);
    expect(renderer!.root.findAllByProps({ scope: 'row' })).toHaveLength(3);
    expect(renderer!.root.findByProps({ 'data-testid': 'cathef-assistive-note' }).props.role).toBe(
      'note'
    );
  });
});
