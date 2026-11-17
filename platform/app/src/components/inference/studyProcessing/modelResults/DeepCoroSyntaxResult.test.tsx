import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DeepCoroSyntaxResult } from './DeepCoroSyntaxResult';
import { deepCoroSyntaxResultFixtures } from './deepCoroSyntaxFixtures';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
    i18n: { language: 'en-US' },
  }),
}));

describe('DeepCoroSyntaxResult', () => {
  test('presents global, territory, severity, and threshold results', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroSyntaxResult payload={deepCoroSyntaxResultFixtures.validV5} />
      );
    });
    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('24.5');
    expect(rendered).toContain('17.2');
    expect(rendered).toContain('7.3');
    expect(rendered).toContain('68.0%');
    expect(rendered).toContain('At or above threshold');
  });

  test('does not display model-authored diagnosis, note, or recommendations', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DeepCoroSyntaxResult payload={deepCoroSyntaxResultFixtures.validV5} />
      );
    });
    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).not.toContain('Synthetic modified SYNTAX');
    expect(rendered).not.toContain('Synthetic model-authored note');
    expect(rendered).not.toContain('<strong>');
    expect(renderer!.root.findAllByProps({ role: 'note' })).toHaveLength(1);
  });
});
