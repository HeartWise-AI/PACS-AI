import { parseCathEfClipResultPayload } from './cathEfClipContract';
import { cathEfClipResultFixtures } from './cathEfClipFixtures';

describe('CathEF-CLIP result contract', () => {
  test.each(['reducedV1', 'preservedV1'] as const)(
    'accepts the synthetic deployed %s payload shape',
    fixture => {
      expect(parseCathEfClipResultPayload(cathEfClipResultFixtures[fixture])).toEqual(
        cathEfClipResultFixtures[fixture]
      );
    }
  );

  test('keeps only approved fields', () => {
    const parsed = parseCathEfClipResultPayload({
      ...cathEfClipResultFixtures.reducedV1,
      futureTopLevelField: 'ignored',
      predictions: {
        ...cathEfClipResultFixtures.reducedV1.predictions,
        LVEF: {
          ...cathEfClipResultFixtures.reducedV1.predictions.LVEF,
          futureLvefField: 'ignored',
        },
        reducedEF: {
          ...cathEfClipResultFixtures.reducedV1.predictions.reducedEF,
          futureClassificationField: 'ignored',
        },
      },
    });

    expect(parsed).toEqual(cathEfClipResultFixtures.reducedV1);
    expect(parsed).not.toHaveProperty('futureTopLevelField');
    expect(parsed?.predictions.LVEF).not.toHaveProperty('futureLvefField');
    expect(parsed?.predictions.reducedEF).not.toHaveProperty('futureClassificationField');
  });

  test.each([
    ['non-finite LVEF', { LVEF: { value: Number.NaN, unit: '%' } }],
    ['LVEF below zero', { LVEF: { value: -0.1, unit: '%' } }],
    ['LVEF above 100', { LVEF: { value: 100.1, unit: '%' } }],
    ['incorrect unit', { LVEF: { value: 45, unit: 'percent' } }],
    [
      'probability below zero',
      { reducedEF: { probability: -0.001, threshold: 0.5, diagnosis: 'reduced' } },
    ],
    [
      'probability above one',
      { reducedEF: { probability: 1.001, threshold: 0.5, diagnosis: 'reduced' } },
    ],
    [
      'threshold outside its range',
      { reducedEF: { probability: 0.5, threshold: 1.001, diagnosis: 'reduced' } },
    ],
    [
      'unknown classification',
      { reducedEF: { probability: 0.5, threshold: 0.5, diagnosis: 'borderline' } },
    ],
  ])('rejects %s', (_name, override) => {
    expect(
      parseCathEfClipResultPayload({
        ...cathEfClipResultFixtures.reducedV1,
        predictions: { ...cathEfClipResultFixtures.reducedV1.predictions, ...override },
      })
    ).toBeNull();
  });

  test('rejects the deployed empty no-video result as a successful estimate', () => {
    expect(
      parseCathEfClipResultPayload({
        diagnosis: 'No video could be extracted',
        predictions: {},
        modelRecommendations: { en: 'No video', fr: 'Aucune vidéo', presentable: false },
      })
    ).toBeNull();
  });

  test('rejects invalid recommendation metadata', () => {
    expect(
      parseCathEfClipResultPayload({
        ...cathEfClipResultFixtures.reducedV1,
        modelRecommendations: {
          ...cathEfClipResultFixtures.reducedV1.modelRecommendations,
          presentable: 'yes',
        },
      })
    ).toBeNull();
  });

  test('contains no patient or study identifiers in its fixtures', () => {
    expect(JSON.stringify(cathEfClipResultFixtures).toLowerCase()).not.toMatch(
      /patient|mrn|studyinstanceuid|study_uid/
    );
  });
});
