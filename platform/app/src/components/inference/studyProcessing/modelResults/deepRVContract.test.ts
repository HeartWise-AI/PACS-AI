import { parseDeepRVResultPayload } from './deepRVContract';
import { deepRVResultFixtures } from './deepRVFixtures';

describe('DeepRV result contract', () => {
  test('accepts the synthetic deployed 1.0.0 payload shape', () => {
    expect(parseDeepRVResultPayload(deepRVResultFixtures.validV1)).toEqual(
      deepRVResultFixtures.validV1
    );
  });

  test('keeps only approved fields when additional data is present', () => {
    const parsed = parseDeepRVResultPayload({
      ...deepRVResultFixtures.validV1,
      futureTopLevelField: '<script>not executable</script>',
      predictions: {
        ...deepRVResultFixtures.validV1.predictions,
        futurePredictionField: 'ignored',
      },
    });

    expect(parsed).toEqual(deepRVResultFixtures.validV1);
    expect(parsed).not.toHaveProperty('futureTopLevelField');
    expect(parsed?.predictions).not.toHaveProperty('futurePredictionField');
  });

  test.each([
    ['missing predictions', undefined],
    ['non-object predictions', 'normal'],
  ])('rejects a payload with %s', (_name, predictions) => {
    expect(parseDeepRVResultPayload({ ...deepRVResultFixtures.validV1, predictions })).toBeNull();
  });

  test.each([
    ['non-finite probability', { probability: Number.NaN }],
    ['probability below zero', { probability: -0.001 }],
    ['probability above one', { probability: 1.001 }],
    ['string class', { class: 'normal' }],
    ['unknown numeric class', { class: 2 }],
  ])('rejects predictions with %s', (_name, override) => {
    expect(
      parseDeepRVResultPayload({
        ...deepRVResultFixtures.validV1,
        predictions: { ...deepRVResultFixtures.validV1.predictions, ...override },
      })
    ).toBeNull();
  });

  test('rejects invalid recommendation metadata', () => {
    expect(
      parseDeepRVResultPayload({
        ...deepRVResultFixtures.validV1,
        modelRecommendations: {
          ...deepRVResultFixtures.validV1.modelRecommendations,
          presentable: 'yes',
        },
      })
    ).toBeNull();
  });

  test('contains no patient or study identifiers in its fixture', () => {
    const fixtureText = JSON.stringify(deepRVResultFixtures).toLowerCase();

    expect(fixtureText).not.toMatch(/patient|mrn|studyinstanceuid|study_uid/);
  });
});
