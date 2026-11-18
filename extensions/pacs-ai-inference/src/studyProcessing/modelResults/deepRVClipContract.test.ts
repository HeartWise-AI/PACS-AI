import { parseDeepRVClipResultPayload } from './deepRVClipContract';
import { deepRVClipResultFixtures } from './deepRVClipFixtures';

describe('DeepRV-CLIP result contract', () => {
  test('accepts the synthetic deployed 1.0.0 payload shape', () => {
    expect(parseDeepRVClipResultPayload(deepRVClipResultFixtures.validV1)).toEqual(
      deepRVClipResultFixtures.validV1
    );
  });

  test('keeps only approved fields when additional data is present', () => {
    const parsed = parseDeepRVClipResultPayload({
      ...deepRVClipResultFixtures.validV1,
      futureTopLevelField: '<script>not executable</script>',
      predictions: {
        ...deepRVClipResultFixtures.validV1.predictions,
        futurePrediction: { probability: 0.1 },
        abnormalRV: {
          ...deepRVClipResultFixtures.validV1.predictions.abnormalRV,
          futurePredictionField: 'ignored',
        },
      },
    });

    expect(parsed).toEqual(deepRVClipResultFixtures.validV1);
    expect(parsed).not.toHaveProperty('futureTopLevelField');
    expect(parsed?.predictions).not.toHaveProperty('futurePrediction');
    expect(parsed?.predictions.abnormalRV).not.toHaveProperty('futurePredictionField');
  });

  test.each([
    ['missing prediction', undefined],
    ['non-object prediction', 'normal'],
  ])('rejects a payload with %s', (_name, abnormalRV) => {
    expect(
      parseDeepRVClipResultPayload({
        ...deepRVClipResultFixtures.validV1,
        predictions: { abnormalRV },
      })
    ).toBeNull();
  });

  test.each([
    ['non-finite probability', { probability: Number.NaN }],
    ['probability below zero', { probability: -0.001 }],
    ['probability above one', { probability: 1.001 }],
    ['non-finite threshold', { threshold: Number.POSITIVE_INFINITY }],
    ['threshold below zero', { threshold: -0.001 }],
    ['threshold above one', { threshold: 1.001 }],
    ['unknown diagnosis', { diagnosis: 'reduced' }],
  ])('rejects a prediction with %s', (_name, override) => {
    expect(
      parseDeepRVClipResultPayload({
        ...deepRVClipResultFixtures.validV1,
        predictions: {
          abnormalRV: {
            ...deepRVClipResultFixtures.validV1.predictions.abnormalRV,
            ...override,
          },
        },
      })
    ).toBeNull();
  });

  test('rejects invalid recommendation metadata', () => {
    expect(
      parseDeepRVClipResultPayload({
        ...deepRVClipResultFixtures.validV1,
        modelRecommendations: {
          ...deepRVClipResultFixtures.validV1.modelRecommendations,
          presentable: 'yes',
        },
      })
    ).toBeNull();
  });

  test('contains no patient or study identifiers in its fixture', () => {
    const fixtureText = JSON.stringify(deepRVClipResultFixtures).toLowerCase();

    expect(fixtureText).not.toMatch(/patient|mrn|studyinstanceuid|study_uid/);
  });
});
