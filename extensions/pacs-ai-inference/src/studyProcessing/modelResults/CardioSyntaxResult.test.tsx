import React from 'react';
import { render, screen } from '@testing-library/react';
import { CardioSyntaxResult } from './CardioSyntaxResult';
import { cardioSyntaxResultFixtures } from './cardioSyntaxFixtures';

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

describe('CardioSyntaxResult', () => {
  test('presents all three documented territories with one-decimal scores and categories', () => {
    const { container } = render(
      <CardioSyntaxResult payload={cardioSyntaxResultFixtures.validV1} />
    );

    const rendered = renderedContent(container);
    expect(container.querySelectorAll('[data-testid="cardiosyntax-result"]')).toHaveLength(1);
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
    const { container } = render(
      <CardioSyntaxResult payload={cardioSyntaxResultFixtures.validV1} />
    );

    const rendered = renderedContent(container);
    expect(rendered).not.toContain(cardioSyntaxResultFixtures.validV1.diagnosis);
    expect(rendered).not.toContain(cardioSyntaxResultFixtures.validV1.modelRecommendations.en);
    expect(rendered).not.toContain(cardioSyntaxResultFixtures.validV1.modelRecommendations.fr);
    expect(rendered).toContain('AI-generated estimate');
  });

  test('uses structural list semantics and exposes the assistive note', () => {
    const { container } = render(
      <CardioSyntaxResult payload={cardioSyntaxResultFixtures.validV1} />
    );

    expect(container.querySelectorAll('dl')).toHaveLength(1);
    expect(container.querySelectorAll('dt')).toHaveLength(3);
    expect(container.querySelectorAll('dd')).toHaveLength(3);
    expect(screen.getByTestId('cardiosyntax-assistive-note').getAttribute('role')).toBe('note');
  });
});
