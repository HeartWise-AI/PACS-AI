import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { CardioSyntaxResult } from './CardioSyntaxResult';
import { cardioSyntaxResultFixtures } from './cardioSyntaxFixtures';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
  }),
}));

describe('CardioSyntaxResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('presents all three documented territories with one-decimal scores and categories', () => {
    act(() => {
      renderer = TestRenderer.create(
        <CardioSyntaxResult payload={cardioSyntaxResultFixtures.validV1} />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(renderer!.root.findAllByProps({ 'data-testid': 'cardiosyntax-result' })).toHaveLength(1);
    expect(rendered).toContain('Global cardiac SYNTAX');
    expect(rendered).toContain('Left cardiac SYNTAX');
    expect(rendered).toContain('Right cardiac SYNTAX');
    expect(rendered).toContain('24.5');
    expect(rendered).toContain('12.3');
    expect(rendered).toContain('1.2');
    expect(rendered).toContain('Moderate');
    expect(rendered).toContain('Mild');
    expect(rendered).toContain('No disease');
  });

  test('does not display model-generated diagnosis or recommendation strings', () => {
    act(() => {
      renderer = TestRenderer.create(
        <CardioSyntaxResult payload={cardioSyntaxResultFixtures.validV1} />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).not.toContain(cardioSyntaxResultFixtures.validV1.diagnosis);
    expect(rendered).not.toContain(cardioSyntaxResultFixtures.validV1.modelRecommendations.en);
    expect(rendered).not.toContain(cardioSyntaxResultFixtures.validV1.modelRecommendations.fr);
    expect(rendered).toContain('AI-generated estimate');
  });

  test('uses structural list semantics and exposes the assistive note', () => {
    act(() => {
      renderer = TestRenderer.create(
        <CardioSyntaxResult payload={cardioSyntaxResultFixtures.validV1} />
      );
    });

    expect(renderer!.root.findAllByType('dl')).toHaveLength(1);
    expect(renderer!.root.findAllByType('dt')).toHaveLength(3);
    expect(renderer!.root.findAllByType('dd')).toHaveLength(3);
    expect(
      renderer!.root.findByProps({ 'data-testid': 'cardiosyntax-assistive-note' }).props.role
    ).toBe('note');
  });
});
