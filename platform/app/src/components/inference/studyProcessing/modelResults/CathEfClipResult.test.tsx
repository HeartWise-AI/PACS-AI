import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { cathEfClipResultFixtures } from './cathEfClipFixtures';
import { CathEfClipResult } from './CathEfClipResult';

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

describe('CathEfClipResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test.each([
    ['reducedV1', '37.4%', 'Reduced EF', '78.2%', '50.0%'],
    ['preservedV1', '58.6%', 'Preserved EF', '18.3%', '50.0%'],
  ] as const)(
    'renders the %s estimate and classification',
    (fixture, lvef, label, probability, threshold) => {
      act(() => {
        renderer = TestRenderer.create(
          <CathEfClipResult payload={cathEfClipResultFixtures[fixture]} />
        );
      });

      const rendered = JSON.stringify(renderer!.toJSON());
      expect(textContent(renderer!.root.findByProps({ 'data-testid': 'cathef-clip-lvef' }))).toBe(
        lvef
      );
      expect(rendered).toContain(label);
      expect(rendered).toContain(probability);
      expect(rendered).toContain(threshold);
    }
  );

  test('does not display or interpret model-authored diagnosis and recommendation markup', () => {
    act(() => {
      renderer = TestRenderer.create(
        <CathEfClipResult payload={cathEfClipResultFixtures.reducedV1} />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).not.toContain(cathEfClipResultFixtures.reducedV1.diagnosis);
    expect(rendered).not.toContain(cathEfClipResultFixtures.reducedV1.modelRecommendations.en);
    expect(rendered).not.toContain(cathEfClipResultFixtures.reducedV1.modelRecommendations.fr);
    expect(renderer!.root.findAllByType('strong')).toHaveLength(0);
  });

  test('uses semantic descriptions and exposes an assistive note', () => {
    act(() => {
      renderer = TestRenderer.create(
        <CathEfClipResult payload={cathEfClipResultFixtures.reducedV1} />
      );
    });

    expect(renderer!.root.findAllByType('dl')).toHaveLength(1);
    expect(renderer!.root.findAllByType('dt')).toHaveLength(2);
    expect(renderer!.root.findAllByType('dd')).toHaveLength(2);
    expect(
      renderer!.root.findByProps({ 'data-testid': 'cathef-clip-assistive-note' }).props.role
    ).toBe('note');
  });
});
