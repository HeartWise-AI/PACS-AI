import { DEEP_CORO_CLIP_ARTERIES, parseDeepCoroClipResultPayload } from './deepCoroClipContract';
import { deepCoroClipResultFixtures } from './deepCoroClipFixtures';

describe('DeepCORO-CLIP result contract', () => {
  test('accepts the synthetic deployed 1.0.0 payload shape', () => {
    expect(parseDeepCoroClipResultPayload(deepCoroClipResultFixtures.validV1)).toEqual(
      deepCoroClipResultFixtures.validV1
    );
  });

  test('keeps only approved fields when additional data is present', () => {
    const parsed = parseDeepCoroClipResultPayload({
      ...deepCoroClipResultFixtures.validV1,
      futureTopLevelField: '<script>not executable</script>',
      predictions: {
        ...deepCoroClipResultFixtures.validV1.predictions,
        'Future Artery': deepCoroClipResultFixtures.validV1.predictions['Proximal RCA'],
        'Proximal RCA': {
          ...deepCoroClipResultFixtures.validV1.predictions['Proximal RCA'],
          futurePredictionField: 'ignored',
        },
      },
    });

    expect(parsed).toEqual(deepCoroClipResultFixtures.validV1);
    expect(parsed).not.toHaveProperty('futureTopLevelField');
    expect(parsed?.predictions).not.toHaveProperty('Future Artery');
    expect(parsed?.predictions['Proximal RCA']).not.toHaveProperty('futurePredictionField');
  });

  test.each(DEEP_CORO_CLIP_ARTERIES)('rejects a payload missing %s', artery => {
    const predictions: Record<string, unknown> = {
      ...deepCoroClipResultFixtures.validV1.predictions,
    };
    delete predictions[artery];

    expect(
      parseDeepCoroClipResultPayload({
        ...deepCoroClipResultFixtures.validV1,
        predictions,
      })
    ).toBeNull();
  });

  test.each([
    ['non-finite stenosis estimate', { regression: Number.NaN }],
    ['stenosis estimate below zero', { regression: -0.1 }],
    ['stenosis estimate above 100', { regression: 100.1 }],
    ['probability below zero', { stenosis_prob: -0.001 }],
    ['probability above one', { calcif_prob: 1.001 }],
    ['unknown stenosis diagnosis', { diagnosis_stenosis: 'narrowed' }],
    ['unknown calcification diagnosis', { diagnosis_calcif: 'calcium' }],
    ['unknown CTO diagnosis', { diagnosis_cto: 'occluded' }],
    ['unknown thrombus diagnosis', { diagnosis_thrombus: 'present' }],
  ])('rejects a prediction with %s', (_name, override) => {
    expect(
      parseDeepCoroClipResultPayload({
        ...deepCoroClipResultFixtures.validV1,
        predictions: {
          ...deepCoroClipResultFixtures.validV1.predictions,
          'Proximal RCA': {
            ...deepCoroClipResultFixtures.validV1.predictions['Proximal RCA'],
            ...override,
          },
        },
      })
    ).toBeNull();
  });

  test('rejects invalid recommendation metadata', () => {
    expect(
      parseDeepCoroClipResultPayload({
        ...deepCoroClipResultFixtures.validV1,
        modelRecommendations: {
          ...deepCoroClipResultFixtures.validV1.modelRecommendations,
          presentable: 'yes',
        },
      })
    ).toBeNull();
  });

  test('contains no patient or study identifiers in its fixture', () => {
    const fixtureText = JSON.stringify(deepCoroClipResultFixtures).toLowerCase();

    expect(fixtureText).not.toMatch(/patient|mrn|studyinstanceuid|study_uid/);
  });
});
