import {
  buildReadableResult,
  classifyReadableResultLabel,
  formatReadableResultRow,
  parseEmbeddedJSON,
  READABLE_RESULT_MAX_JSON_STRING_LENGTH,
  READABLE_RESULT_MAX_ROWS,
  READABLE_RESULT_MAX_VALUE_LENGTH,
  type ReadableResult,
} from './readableResult';
import { readableEchoDiagnosis, readableResultFixtures } from './readableResultFixtures';

function rows(readable: ReadableResult | null) {
  return (readable?.sections ?? []).flatMap(section => section.groups.flatMap(group => group.rows));
}

describe('readable result', () => {
  describe('values', () => {
    it('splits a trailing parenthesised qualifier from the value', () => {
      expect(formatReadableResultRow('LV ejection fraction', '61.5 % (Normal)')).toEqual({
        label: 'LV ejection fraction',
        value: '61.5 %',
        qualifier: 'Normal',
        flag: 'normal',
      });
    });

    it('flags abnormal qualifiers, whatever their severity wording', () => {
      expect(formatReadableResultRow('a', '39.8 mL (Abnormal)').flag).toBe('abnormal');
      expect(formatReadableResultRow('a', '37.6 % (Moderately Abnormal)').flag).toBe('abnormal');
      expect(formatReadableResultRow('a', 'Abnormal').flag).toBe('abnormal');
    });

    it('keeps other qualifiers unflagged', () => {
      expect(formatReadableResultRow('a', '44.0 mmHg (Mild Pulmonary Hypertension)')).toEqual(
        expect.objectContaining({
          value: '44.0 mmHg',
          qualifier: 'Mild Pulmonary Hypertension',
          flag: null,
        })
      );
    });

    it('shows alternatives separated by a slash', () => {
      expect(formatReadableResultRow('a', 'Normal|Hyperdynamic')).toEqual(
        expect.objectContaining({ value: 'Normal / Hyperdynamic', qualifier: null, flag: null })
      );
    });

    it('turns the underscores of a bare enum value into spaces', () => {
      expect(formatReadableResultRow('a', 'none_trace').value).toBe('none trace');
      expect(formatReadableResultRow('a', 'mild_moderate|severe').value).toBe(
        'mild moderate / severe'
      );
      // Free text is not an enum value.
      expect(formatReadableResultRow('a', 'see file_name here').value).toBe('see file_name here');
    });

    it('does not mistake a parenthesised number or a lone parenthesis for a qualifier', () => {
      expect(formatReadableResultRow('a', '12 (3)')).toEqual(
        expect.objectContaining({ value: '12 (3)', qualifier: null })
      );
      expect(formatReadableResultRow('a', '(Normal)')).toEqual(
        expect.objectContaining({ value: '(Normal)', qualifier: null })
      );
    });

    it('renders numbers, booleans and null as text', () => {
      expect(formatReadableResultRow('a', 24.5).value).toBe('24.5');
      expect(formatReadableResultRow('a', false).value).toBe('false');
      expect(formatReadableResultRow('a', null).value).toBe('—');
      expect(formatReadableResultRow('a', '').value).toBe('—');
    });
  });

  describe('embedded JSON', () => {
    it('parses serialised objects and arrays only', () => {
      expect(parseEmbeddedJSON('{"a":1}')).toEqual({ a: 1 });
      expect(parseEmbeddedJSON(' [1, 2] ')).toEqual([1, 2]);
      expect(parseEmbeddedJSON('"text"')).toBeUndefined();
      expect(parseEmbeddedJSON('42')).toBeUndefined();
      expect(parseEmbeddedJSON('plain text')).toBeUndefined();
    });

    it('ignores invalid JSON', () => {
      expect(parseEmbeddedJSON('{"a": 1')).toBeUndefined();
      expect(parseEmbeddedJSON('{not json}')).toBeUndefined();
    });

    it('does not parse a string over the size cap', () => {
      const huge = JSON.stringify({ a: 'x'.repeat(READABLE_RESULT_MAX_JSON_STRING_LENGTH) });
      expect(parseEmbeddedJSON(huge)).toBeUndefined();
    });
  });

  describe('grouping', () => {
    it('classifies labels by generic cardiac wording', () => {
      expect(classifyReadableResultLabel('Left ventricular (LV) ejection fraction')).toBe(
        'leftVentricle'
      );
      expect(classifyReadableResultLabel('RV size')).toBe('rightVentricle');
      expect(classifyReadableResultLabel('LA volume')).toBe('leftAtrium');
      expect(classifyReadableResultLabel('Elevated RA pressure')).toBe('rightAtrium');
      expect(classifyReadableResultLabel('Aortic valve stenosis')).toBe('valves');
      expect(classifyReadableResultLabel('Pericardial effusion')).toBe('other');
      // Abbreviations are whole upper-case words.
      expect(classifyReadableResultLabel('Plasma level')).toBe('other');
    });

    it('groups a serialised echo interpretation and keeps the order inside each group', () => {
      const readable = buildReadableResult(readableResultFixtures.serialisedDiagnosis);

      expect(readable?.omittedKeys).toEqual([]);
      expect(readable?.sections).toHaveLength(1);
      expect(readable?.sections[0].key).toBe('diagnosis');
      expect(readable?.sections[0].groups.map(group => group.id)).toEqual([
        'leftVentricle',
        'rightVentricle',
        'leftAtrium',
        'rightAtrium',
        'valves',
        'other',
      ]);
      expect(readable?.sections[0].groups[0].rows.map(row => row.label)).toEqual([
        'Left ventricular (LV) ejection fraction',
        'LV end-diastolic volume',
        'LV stroke volume',
        'LV size',
        'LV systolic function',
      ]);
      // Nothing is dropped by grouping.
      expect(rows(readable)).toHaveLength(Object.keys(readableEchoDiagnosis).length);
    });

    it('keeps one table in the original order when grouping does not apply', () => {
      const readable = buildReadableResult({ syntax_score: 24.5, category: 'intermediate' });

      expect(readable?.sections).toEqual([
        {
          key: null,
          groups: [
            {
              id: null,
              rows: [
                { label: 'syntax_score', value: '24.5', qualifier: null, flag: null },
                { label: 'category', value: 'intermediate', qualifier: null, flag: null },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe('fallback to the generic view', () => {
    it.each([
      ['a scalar', 'malformed scalar payload'],
      ['a number', 12],
      ['null', null],
      ['an array', [{ a: 1 }, { a: 2 }]],
      ['a serialised array', '[1,2,3]'],
      ['an empty object', {}],
      ['only nested objects', { outer: { inner: { value: 1 } } }],
      ['a serialised nested object', { diagnosis: JSON.stringify({ outer: { inner: 1 } }) }],
      ['only an array field', { probabilities: [0.1, 0.9] }],
      ['only a very long string', { report: 'x'.repeat(READABLE_RESULT_MAX_VALUE_LENGTH + 1) }],
    ])('returns null for %s', (_name, value) => {
      expect(buildReadableResult(value)).toBeNull();
    });

    it('returns null for an invalid serialised object, leaving the raw string to the generic view', () => {
      expect(buildReadableResult('{"diagnosis": ')).toBeNull();
      // As a field it is ordinary text, not a table of its own.
      expect(rows(buildReadableResult({ diagnosis: '{"a": ' }))).toEqual([
        expect.objectContaining({ label: 'diagnosis', value: '{"a":' }),
      ]);
    });

    it('returns null when there are too many rows to tabulate', () => {
      const big = Object.fromEntries(
        Array.from({ length: READABLE_RESULT_MAX_ROWS + 1 }, (_, index) => [`key ${index}`, index])
      );
      expect(buildReadableResult(big)).toBeNull();
      expect(buildReadableResult({ diagnosis: JSON.stringify(big) })).toBeNull();
    });

    it('does not parse an oversized serialised object', () => {
      const huge = JSON.stringify({ a: 'x'.repeat(READABLE_RESULT_MAX_JSON_STRING_LENGTH) });
      expect(buildReadableResult({ diagnosis: huge })).toBeNull();
    });
  });

  it('tabulates the flat fields and names the ones left to the raw data', () => {
    const readable = buildReadableResult({
      diagnosis: JSON.stringify({ 'LV size': 'Normal' }),
      predictions: { 'LV size': [0.9, 0.1] },
      empty: {},
      model: 'synthetic',
    });

    expect(readable?.sections.map(section => section.key)).toEqual([null, 'diagnosis']);
    expect(rows(readable).map(row => row.label)).toEqual(['model', 'LV size']);
    expect(readable?.omittedKeys).toEqual(['predictions']);
  });

  it('parses only one level of serialised JSON', () => {
    const readable = buildReadableResult({
      diagnosis: JSON.stringify({ note: JSON.stringify({ deep: 1 }) }),
    });

    expect(rows(readable)).toEqual([
      expect.objectContaining({ label: 'note', value: '{"deep":1}' }),
    ]);
  });

  it('reads a whole result that is itself a serialised object', () => {
    expect(rows(buildReadableResult(JSON.stringify({ 'LV size': 'Normal' })))).toEqual([
      { label: 'LV size', value: 'Normal', qualifier: null, flag: 'normal' },
    ]);
  });

  it('treats keys as plain labels', () => {
    const readable = buildReadableResult(
      JSON.parse('{"__proto__": "x", "constructor": "y", "<b>k</b>": "<img src=x>"}')
    );

    expect(rows(readable).map(row => [row.label, row.value])).toEqual([
      ['__proto__', 'x'],
      ['constructor', 'y'],
      ['<b>k</b>', '<img src=x>'],
    ]);
  });
});
