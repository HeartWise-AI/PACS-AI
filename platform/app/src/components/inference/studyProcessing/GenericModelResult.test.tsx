import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
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

function renderedText(node: ReactTestInstance | string): string {
  if (typeof node === 'string') {
    return node;
  }
  return node.children.map(renderedText).join(' ');
}

describe('GenericModelResult', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('renders nested objects, arrays, and every JSON primitive without interpretation', () => {
    act(() => {
      renderer = TestRenderer.create(
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
    });

    const text = renderedText(renderer!.root);
    expect(text).toContain('score');
    expect(text).toContain('24.5');
    expect(text).toContain('true');
    expect(text).toContain('null');
    expect(text).toContain('intermediate');
    expect(text).toContain('false');
    expect(text).toContain('exact_key_name');
    expect(text).toContain('preserved');
    expect(renderer!.root.findAllByType('details').length).toBeGreaterThan(0);
  });

  test('renders model-provided markup only as inert text', () => {
    const suppliedMarkup = '<img src=x onerror="alert(1)"><script>steal()</script>';
    act(() => {
      renderer = TestRenderer.create(<GenericModelResult value={{ report: suppliedMarkup }} />);
    });

    expect(renderedText(renderer!.root)).toContain(suppliedMarkup);
    expect(renderer!.root.findAllByType('script')).toHaveLength(0);
    expect(
      renderer!.root.findAll(node => Object.hasOwn(node.props, 'dangerouslySetInnerHTML'))
    ).toHaveLength(0);
  });

  test('bounds large collections and reports omitted entry count', () => {
    const value = Array.from(
      { length: GENERIC_RESULT_MAX_COLLECTION_ITEMS + 3 },
      (_, index) => `entry-${index}`
    );
    act(() => {
      renderer = TestRenderer.create(<GenericModelResult value={value} />);
    });

    const text = renderedText(renderer!.root);
    expect(text).toContain(`entry-${GENERIC_RESULT_MAX_COLLECTION_ITEMS - 1}`);
    expect(text).not.toContain(`entry-${GENERIC_RESULT_MAX_COLLECTION_ITEMS}`);
    expect(text).toContain('3 additional entries are not shown');
    expect(
      renderer!.root.findByProps({ 'data-testid': 'generic-model-result-collection-limit' })
    ).toBeDefined();
  });

  test('bounds pathological nesting depth', () => {
    let value: unknown = 'hidden-value';
    for (let depth = 0; depth <= GENERIC_RESULT_MAX_DEPTH; depth += 1) {
      value = { nested: value };
    }

    act(() => {
      renderer = TestRenderer.create(<GenericModelResult value={value} />);
    });

    const text = renderedText(renderer!.root);
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
    act(() => {
      renderer = TestRenderer.create(<GenericModelResult value={value} />);
    });

    expect(renderer!.root.findByProps({ id: 'generic-model-result-title' })).toBeDefined();
  });
});
