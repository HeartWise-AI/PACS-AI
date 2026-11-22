import React from 'react';
import { render } from '@testing-library/react';
import { DeepCoroSyntaxResult } from './DeepCoroSyntaxResult';
import { deepCoroSyntaxResultFixtures } from './deepCoroSyntaxFixtures';

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

describe('DeepCoroSyntaxResult', () => {
  test('presents global, territory, severity, and threshold results', () => {
    const { container } = render(
      <DeepCoroSyntaxResult payload={deepCoroSyntaxResultFixtures.validV5} />
    );
    const rendered = renderedContent(container);
    expect(rendered).toContain('24.5');
    expect(rendered).toContain('17.2');
    expect(rendered).toContain('7.3');
    expect(rendered).toContain('68.0%');
    expect(rendered).toContain('At or above threshold');
  });

  test('does not display model-authored diagnosis, note, or recommendations', () => {
    const { container } = render(
      <DeepCoroSyntaxResult payload={deepCoroSyntaxResultFixtures.validV5} />
    );
    const rendered = renderedContent(container);
    expect(rendered).not.toContain('Synthetic modified SYNTAX');
    expect(rendered).not.toContain('Synthetic model-authored note');
    expect(rendered).not.toContain('<strong>');
    expect(container.querySelectorAll('[role="note"]')).toHaveLength(1);
  });
});
