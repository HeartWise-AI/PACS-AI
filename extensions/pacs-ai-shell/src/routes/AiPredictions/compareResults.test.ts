import { compareResults, flatResult } from './compareResults';

describe('compare with latest', () => {
  test('flat results give a two-column diff that marks changed values', () => {
    const comparison = compareResults(
      { diagnosis: 'abnormal', probability: 0.71, note: null },
      { diagnosis: 'normal', probability: 0.71, extra: true }
    );
    expect(comparison).toEqual({
      kind: 'flat',
      changedCount: 3,
      rows: [
        { key: 'diagnosis', latest: 'abnormal', earlier: 'normal', changed: true },
        { key: 'probability', latest: '0.71', earlier: '0.71', changed: false },
        { key: 'note', latest: 'null', earlier: '—', changed: true },
        { key: 'extra', latest: '—', earlier: 'true', changed: true },
      ],
    });
  });

  test('a JSON object serialised in the diagnosis string is compared field by field', () => {
    const panEcho = (lvef: string) => ({
      diagnosis: JSON.stringify({ 'Left ventricular (LV) ejection fraction': lvef }),
      predictions: { lvef: 1 },
    });
    expect(flatResult(panEcho('58 %'))).toEqual({
      'Left ventricular (LV) ejection fraction': '58 %',
    });
    const comparison = compareResults(panEcho('58 %'), panEcho('52 %'));
    expect(comparison.kind).toBe('flat');
    expect(comparison.kind === 'flat' && comparison.changedCount).toBe(1);
  });

  test('nested results are shown as two raw JSON panes', () => {
    const comparison = compareResults({ predictions: { a: 1 } }, { predictions: { a: 2 } });
    expect(comparison).toEqual({
      kind: 'raw',
      latest: JSON.stringify({ predictions: { a: 1 } }, null, 2),
      earlier: JSON.stringify({ predictions: { a: 2 } }, null, 2),
    });
  });
});
