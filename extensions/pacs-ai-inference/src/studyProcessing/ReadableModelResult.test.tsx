import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
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

function renderedText(node: ReactTestInstance | string): string {
  if (typeof node === 'string') {
    return node;
  }
  return node.children.map(renderedText).join(' ');
}

describe('ReadableOrGenericModelResult', () => {
  let renderer: ReactTestRenderer | null = null;

  function render(value: unknown) {
    act(() => {
      renderer = TestRenderer.create(<ReadableOrGenericModelResult value={value} />);
    });
    return renderer!.root;
  }

  function byTestId(id: string) {
    return renderer!.root.findAll(
      node => typeof node.type === 'string' && node.props['data-testid'] === id
    );
  }

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  it('renders a serialised echo interpretation as label and value rows', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    expect(byTestId('readable-model-result')).toHaveLength(1);
    expect(byTestId('readable-model-result-row')).toHaveLength(16);
    const row = byTestId('readable-model-result-row').find(candidate =>
      renderedText(candidate).includes('Left ventricular (LV) ejection fraction')
    )!;
    expect(row.findByType('th').props.scope).toBe('row');
    expect(renderedText(row.findByType('td'))).toContain('61.5 %');
    expect(renderedText(row.findByType('td'))).toContain('Normal');
    // The serialised string itself is not what the reader sees first.
    expect(renderedText(byTestId('readable-model-result')[0])).not.toContain('{"');
  });

  it('groups the rows under headings', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    expect(byTestId('readable-model-result-group').map(group => group.props['data-group'])).toEqual(
      ['leftVentricle', 'rightVentricle', 'leftAtrium', 'rightAtrium', 'valves', 'other']
    );
    const text = renderedText(renderer!.root);
    expect(text).toContain('Left ventricle');
    expect(text).toContain('Valves');
  });

  it('marks abnormal values with more than a colour', () => {
    render(readableResultFixtures.serialisedDiagnosis);

    const abnormalRows = byTestId('readable-model-result-row').filter(
      row => row.props['data-flag'] === 'abnormal'
    );
    expect(abnormalRows.map(row => renderedText(row.findByType('th')))).toEqual([
      'LV stroke volume',
      'LA volume',
    ]);
    abnormalRows.forEach(row => {
      const mark = row.findByProps({ 'data-testid': 'readable-model-result-abnormal-mark' });
      expect(mark.props.role).toBe('img');
      expect(mark.props['aria-label']).toBe('Flagged abnormal');
      expect(renderedText(row)).toContain('Abnormal');
      expect(row.findByType('th').props.className).toContain('font-bold');
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
    expect(raw[0].type).toBe('details');
    expect(raw[0].props.open).toBeUndefined();
    expect(renderedText(raw[0].findAllByType('summary')[0])).toBe('Raw data');
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
    expect(root.findAllByType('img')).toHaveLength(0);
    expect(root.findAllByType('script')).toHaveLength(0);
    expect(root.findAll(node => node.props.dangerouslySetInnerHTML !== undefined)).toHaveLength(0);
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
    expect(renderedText(renderer!.root)).toContain('Result data');
  });
});
