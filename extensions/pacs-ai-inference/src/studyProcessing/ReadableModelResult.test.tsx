import React from 'react';
import { render as renderWithDom } from '@testing-library/react';
import { ReadableOrGenericModelResult } from './ReadableModelResult';
import { readableResultFixtures } from './readableResultFixtures';

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

function findOne(root: Element, selector: string): HTMLElement {
  const matches = root.querySelectorAll<HTMLElement>(selector);
  expect(matches).toHaveLength(1);
  return matches[0];
}

// Host props React applied to each rendered DOM element.
function hostProps(element: Element): Record<string, unknown> {
  const key = Object.keys(element).find(name => name.startsWith('__reactProps$'));
  expect(key).toBeDefined();
  return (element as unknown as Record<string, Record<string, unknown>>)[key!];
}

describe('ReadableOrGenericModelResult', () => {
  let container: HTMLElement;

  function render(value: unknown) {
    ({ container } = renderWithDom(<ReadableOrGenericModelResult value={value} />));
    return container;
  }

  function byTestId(id: string) {
    return Array.from(container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  }

  it('renders a serialised echo interpretation as label and value rows', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    expect(byTestId('readable-model-result')).toHaveLength(1);
    expect(byTestId('readable-model-result-row')).toHaveLength(16);
    const row = byTestId('readable-model-result-row').find(candidate =>
      renderedText(candidate).includes('Left ventricular (LV) ejection fraction')
    )!;
    expect(findOne(row, 'th').getAttribute('scope')).toBe('row');
    expect(renderedText(findOne(row, 'td'))).toContain('61.5 %');
    expect(renderedText(findOne(row, 'td'))).toContain('Normal');
    // The serialised string itself is not what the reader sees first.
    expect(renderedText(byTestId('readable-model-result')[0])).not.toContain('{"');
  });

  it('groups the rows under headings', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    expect(
      byTestId('readable-model-result-group').map(group => group.getAttribute('data-group'))
    ).toEqual(['leftVentricle', 'rightVentricle', 'leftAtrium', 'rightAtrium', 'valves', 'other']);
    const text = renderedText(container);
    expect(text).toContain('Left ventricle');
    expect(text).toContain('Valves');
  });

  it('marks abnormal values with more than a colour', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    const abnormalRows = byTestId('readable-model-result-row').filter(
      row => row.getAttribute('data-flag') === 'abnormal'
    );
    expect(abnormalRows.map(row => renderedText(findOne(row, 'th')))).toEqual([
      'LV stroke volume',
      'LA volume',
    ]);
    abnormalRows.forEach(row => {
      const mark = findOne(row, '[data-testid="readable-model-result-abnormal-mark"]');
      expect(mark.getAttribute('role')).toBe('img');
      expect(mark.getAttribute('aria-label')).toBe('Flagged abnormal');
      expect(renderedText(row)).toContain('Abnormal');
      expect(findOne(row, 'th').className).toContain('font-bold');
    });
    expect(byTestId('readable-model-result-abnormal-mark')).toHaveLength(2);
  });

  it('shows qualifiers as badges, alternatives with a slash and enum values without underscores', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    const badges = byTestId('readable-model-result-qualifier');
    expect(badges.map(badge => renderedText(badge).trim())).toEqual(
      expect.arrayContaining(['Normal', 'Mild Pulmonary Hypertension'])
    );
    const text = renderedText(byTestId('readable-model-result')[0]);
    expect(text).toContain('Normal / Hyperdynamic');
    expect(text).toContain('none trace');
    expect(text).toContain('mild moderate');
    expect(text).not.toContain('none_trace');
  });

  it('keeps the raw data reachable and unmodified', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    const raw = byTestId('readable-model-result-raw');
    expect(raw).toHaveLength(1);
    expect(raw[0].tagName.toLowerCase()).toBe('details');
    expect(hostProps(raw[0]).open).toBeUndefined();
    expect(raw[0].hasAttribute('open')).toBe(false);
    expect(renderedText(raw[0].querySelectorAll('summary')[0])).toBe('Raw data');
    expect(renderedText(raw[0])).toContain(readableResultFixtures.serialisedDiagnosis.diagnosis);
  });

  it('shows a disclaimer', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    expect(renderedText(byTestId('readable-model-result-disclaimer')[0])).toContain(
      'Research use only'
    );
  });

  it('names the fields that are only in the raw data', () => {
    render({ diagnosis: JSON.stringify({ 'LV size': 'Normal' }), predictions: { a: [0.1, 0.9] } });

    expect(renderedText(byTestId('readable-model-result-omitted')[0])).toBe(
      'Only in the raw data: predictions.'
    );
  });

  it('renders markup in keys and values as text', () => {
    const root = render({
      diagnosis: JSON.stringify({ '<script>alert(1)</script>': '<img src=x onerror=alert(1)>' }),
    });

    expect(renderedText(root)).toContain('<img src=x onerror=alert(1)>');
    expect(root.querySelectorAll('img')).toHaveLength(0);
    expect(root.querySelectorAll('script')).toHaveLength(0);
    expect(
      Array.from(root.querySelectorAll('*')).filter(
        element => hostProps(element).dangerouslySetInnerHTML !== undefined
      )
    ).toHaveLength(0);
  });

  it.each([
    ['an invalid JSON string', '{"diagnosis": '],
    ['a nested object', { diagnosis: JSON.stringify({ outer: { inner: 1 } }) }],
    ['a very long string', { report: 'x'.repeat(5000) }],
    ['an array', [{ a: 1 }, { a: 2 }]],
  ])('falls back to the generic view for %s', (_name, value) => {
    render(value);

    expect(byTestId('readable-model-result')).toHaveLength(0);
    expect(byTestId('readable-model-result-raw')).toHaveLength(0);
    expect(renderedText(container)).toContain('Result data');
  });
});
