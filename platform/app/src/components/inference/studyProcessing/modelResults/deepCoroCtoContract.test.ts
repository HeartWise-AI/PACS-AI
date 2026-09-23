import { parseDeepCoroCtoResultPayload } from './deepCoroCtoContract';
import { deepCoroCtoResultFixtures } from './deepCoroCtoFixtures';

describe('DeepCORO-CTO result contract', () => {
  test('accepts and sanitizes the deployed 2.0.0 payload', () => {
    const parsed = parseDeepCoroCtoResultPayload({
      ...deepCoroCtoResultFixtures.validV2,
      patientId: 'must-not-survive',
    });
    expect(parsed).toEqual(deepCoroCtoResultFixtures.parsedV2);
    expect(parsed).not.toHaveProperty('patientId');
  });

  test.each([
    [
      'score above four',
      { jctoScore: { ...deepCoroCtoResultFixtures.validV2.predictions.jctoScore, predicted: 4.1 } },
    ],
    ['invalid artery', { ctoArtery: 'LM' }],
    ['missing component', { components: {} }],
    [
      'invalid component probability',
      {
        components: {
          ...deepCoroCtoResultFixtures.validV2.predictions.components,
          jcto_calcification: {
            ...deepCoroCtoResultFixtures.validV2.predictions.components.jcto_calcification,
            probability: -0.1,
          },
        },
      },
    ],
    ['missing per-artery output', { perArtery: {} }],
  ])('rejects %s', (_name, predictionOverride) => {
    expect(
      parseDeepCoroCtoResultPayload({
        ...deepCoroCtoResultFixtures.validV2,
        predictions: {
          ...deepCoroCtoResultFixtures.validV2.predictions,
          ...predictionOverride,
        },
      })
    ).toBeNull();
  });

  test('accepts and strips the deployed LCx warning text', () => {
    const parsed = parseDeepCoroCtoResultPayload({
      ...deepCoroCtoResultFixtures.validV2,
      predictions: {
        ...deepCoroCtoResultFixtures.validV2.predictions,
        ctoArtery: 'LCx',
        ctoArteryWarning: { en: 'authored warning', fr: 'avertissement' },
      },
    });
    expect(parsed?.predictions.ctoArtery).toBe('LCx');
    expect(parsed?.predictions).not.toHaveProperty('ctoArteryWarning');
  });

  test('contains no patient or study identifiers in its fixtures', () => {
    const text = JSON.stringify(deepCoroCtoResultFixtures).toLowerCase();
    expect(text).not.toMatch(/patient|studyinstanceuid|accession/);
  });
});
