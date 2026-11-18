import React from 'react';
import { render } from '@testing-library/react';
import {
  GENERIC_RESULT_MAX_COLLECTION_ITEMS,
  GENERIC_RESULT_MAX_DEPTH,
  GenericModelResult,
} from './GenericModelResult';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      let translation = String(options.defaultValue ?? key);
      Object.entries(options).forEach(([name, value]) => {
        translation = translation.replace(`{{${name}}}`, String(value));
      });
      return translation;
    },
  }),
}));

function renderedText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  return Array.from(node.childNodes, renderedText).join(' ');
}

// Host props React applied to each rendered DOM element.
function hostProps(element: Element): Record<string, unknown> {
  const key = Object.keys(element).find(name => name.startsWith('__reactProps$'));
  expect(key).toBeDefined();
  return (element as unknown as Record<string, Record<string, unknown>>)[key!];
}

describe('GenericModelResult', () => {
  test('renders nested objects, arrays, and every JSON primitive without interpretation', () => {
    const { container } = render(
      <GenericModelResult
        value={{
          score: 24.5,
          accepted: true,
          note: null,
          labels: ['intermediate', false],
          nested: { exact_key_name: 'preserved' },
        }}
      />
    );

    const text = renderedText(container);
    expect(text).toContain('score');
    expect(text).toContain('24.5');
    expect(text).toContain('true');
    expect(text).toContain('null');
    expect(text).toContain('intermediate');
    expect(text).toContain('false');
    expect(text).toContain('exact_key_name');
    expect(text).toContain('preserved');
    expect(text).toContain('array · 2');
    expect(text).toContain('object · 5');
    expect(container.querySelectorAll('details').length).toBeGreaterThan(0);
  });

  test('renders model-provided markup only as inert text', () => {
    const suppliedMarkup = '<img src=x onerror="alert(1)"><script>steal()</script>';
    const { container } = render(<GenericModelResult value={{ report: suppliedMarkup }} />);

    expect(renderedText(container)).toContain(suppliedMarkup);
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(
      Array.from(container.querySelectorAll('*')).filter(element =>
        Object.hasOwn(hostProps(element), 'dangerouslySetInnerHTML')
      )
    ).toHaveLength(0);
  });

  test('bounds large collections and reports omitted entry count', () => {
    const value = Array.from(
      { length: GENERIC_RESULT_MAX_COLLECTION_ITEMS + 3 },
      (_, index) => `entry-${index}`
    );
    const { container } = render(<GenericModelResult value={value} />);

    const text = renderedText(container);
    expect(text).toContain(`entry-${GENERIC_RESULT_MAX_COLLECTION_ITEMS - 1}`);
    expect(text).not.toContain(`entry-${GENERIC_RESULT_MAX_COLLECTION_ITEMS}`);
    expect(text).toContain('3 additional entries are not shown');
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection-limit"]')
    ).toHaveLength(1);
  });

  test('bounds pathological nesting depth', () => {
    let value: unknown = 'hidden-value';
    for (let depth = 0; depth <= GENERIC_RESULT_MAX_DEPTH; depth += 1) {
      value = { nested: value };
    }

    const { container } = render(<GenericModelResult value={value} />);

    const text = renderedText(container);
    expect(text).toContain('Additional nested data is hidden');
    expect(text).not.toContain('hidden-value');
  });

  test.each([
    ['scalar string', 'future payload'],
    ['scalar number', 12.25],
    ['scalar boolean', false],
    ['null payload', null],
    ['empty object', {}],
    ['empty array', []],
  ])('supports %s at the result root', (_label, value) => {
    const { container } = render(<GenericModelResult value={value} />);

    expect(container.querySelectorAll('[id="generic-model-result-title"]')).toHaveLength(1);
  });
});
