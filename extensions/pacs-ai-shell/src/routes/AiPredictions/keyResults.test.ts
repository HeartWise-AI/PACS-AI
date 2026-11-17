import { keyResultModel, summarizeKeyResult } from './keyResults';
import { translate as t } from './testSupport';

describe('key results', () => {
  test('DeepCORO-JEPA reports the model flags, occlusions apart', () => {
    const result = {
      predictions: {
        segments: {
          prox_lad: {
            stenosis_pct: 82,
            display_pct: 80,
            display_category: 'severe',
            significant: true,
          },
          mid_rca: { stenosis_pct: 40, display_category: 'moderate', significant: true },
          dist_rca: { cto: true, significant: true },
          left_main: { stenosis_pct: 10, display_category: 'normal', significant: false },
        },
      },
    };
    expect(summarizeKeyResult('DeepCORO-JEPA', result, t)).toBe(
      'Significant stenosis: Proximal LAD 80% · Occlusion: Distal RCA'
    );
    expect(
      summarizeKeyResult(
        'DeepCORO-JEPA',
        { predictions: { segments: { left_main: { display_category: 'mild' } } } },
        t
      )
    ).toBe('No significant stenosis');
  });

  test('scores and calls of the other main models', () => {
    expect(
      summarizeKeyResult(
        'DeepCORO-SYNTAX',
        { predictions: { syntax: { value: 24.36, band: '23-32' } } },
        t
      )
    ).toBe('SYNTAX 24.4 (23-32)');
    expect(
      summarizeKeyResult(
        'DeepCORO-SYNTAX',
        { predictions: { 'Global Cardiac Syntax': { regression: 7 } } },
        t
      )
    ).toBe('SYNTAX 7');
    expect(
      summarizeKeyResult(
        'DeepCORO-CTO',
        {
          predictions: {
            jctoScore: { predictedInteger: 2, difficulty: 'difficult' },
            ctoArtery: 'RCA',
          },
        },
        t
      )
    ).toBe('J-CTO 2 (difficult) · RCA');
    expect(
      summarizeKeyResult(
        'DeepCORO_MACE',
        {
          predictions: {
            primary: { compositeMace: { probability: 0.234, aboveResearchThreshold: true } },
          },
        },
        t
      )
    ).toBe('MACE research score 0.23 (above threshold)');
    expect(
      summarizeKeyResult(
        'CathEF-CLIP',
        { predictions: { LVEF: { value: 44.6 }, reducedEF: { diagnosis: 'reduced' } } },
        t
      )
    ).toBe('LVEF 45% · reduced');
    expect(
      summarizeKeyResult(
        'DeepRV-CLIP',
        { predictions: { abnormalRV: { diagnosis: 'abnormal', probability: 0.716 } } },
        t
      )
    ).toBe('RV function abnormal (probability 0.72)');
    expect(
      summarizeKeyResult(
        'PanEcho',
        {
          diagnosis: JSON.stringify({
            'Left ventricular (LV) ejection fraction': '58.4 % (Normal)',
          }),
          predictions: {},
        },
        t
      )
    ).toBe('LVEF 58.4 % (Normal)');
  });

  test('other models and unexpected payloads have no key result', () => {
    expect(keyResultModel('EchoPrime')).toBeNull();
    expect(summarizeKeyResult('EchoPrime', { predictions: {} }, t)).toBeNull();
    expect(
      summarizeKeyResult('DeepCORO-SYNTAX', { predictions: { syntax: { value: 'high' } } }, t)
    ).toBeNull();
    expect(summarizeKeyResult('DeepCORO-JEPA', null, t)).toBeNull();
    expect(summarizeKeyResult('PanEcho', { diagnosis: 'not json' }, t)).toBeNull();
  });
});
