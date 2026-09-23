import { CATH_EF_VESSEL_TYPES, parseCathEfResultPayload } from './cathEfContract';
import { cathEfResultFixtures } from './cathEfFixtures';

describe('CathEF result contract', () => {
  test.each(['withLvefV1', 'vesselOnlyV1'] as const)(
    'accepts the synthetic deployed %s payload shape',
    fixture => {
      expect(parseCathEfResultPayload(cathEfResultFixtures[fixture])).toEqual(
        cathEfResultFixtures[fixture]
      );
    }
  );

  test('keeps only approved fields', () => {
    const parsed = parseCathEfResultPayload({
      ...cathEfResultFixtures.withLvefV1,
      futureTopLevelField: 'ignored',
      predictions: {
        ...cathEfResultFixtures.withLvefV1.predictions,
        vessels: [
          {
            ...cathEfResultFixtures.withLvefV1.predictions.vessels[0],
            futureVesselField: 'ignored',
          },
        ],
        LVEF: {
          ...cathEfResultFixtures.withLvefV1.predictions.LVEF,
          values: [
            {
              ...cathEfResultFixtures.withLvefV1.predictions.LVEF.values[0],
              futureLvefField: 'ignored',
            },
          ],
        },
      },
    });

    expect(parsed).not.toHaveProperty('futureTopLevelField');
    expect(parsed?.predictions.vessels[0]).not.toHaveProperty('futureVesselField');
    expect(parsed?.predictions.LVEF?.values[0]).not.toHaveProperty('futureLvefField');
  });

  test.each(CATH_EF_VESSEL_TYPES)('accepts the documented %s acquisition class', vessel => {
    expect(
      parseCathEfResultPayload({
        ...cathEfResultFixtures.vesselOnlyV1,
        predictions: { vessels: [{ seriesNumber: 1, vessel }] },
      })
    ).not.toBeNull();
  });

  test.each([
    ['fractional series number', { seriesNumber: 1.5 }],
    ['negative series number', { seriesNumber: -1 }],
    ['unknown vessel class', { vessel: 'Future Vessel' }],
  ])('rejects a vessel entry with %s', (_name, override) => {
    expect(
      parseCathEfResultPayload({
        ...cathEfResultFixtures.vesselOnlyV1,
        predictions: {
          vessels: [{ ...cathEfResultFixtures.vesselOnlyV1.predictions.vessels[0], ...override }],
        },
      })
    ).toBeNull();
  });

  test.each([
    ['non-finite value', { value: Number.NaN }],
    ['value below zero', { value: -0.1 }],
    ['value above 100', { value: 100.1 }],
    ['unknown series', { seriesNumber: 99 }],
  ])('rejects an LVEF entry with %s', (_name, override) => {
    expect(
      parseCathEfResultPayload({
        ...cathEfResultFixtures.withLvefV1,
        predictions: {
          ...cathEfResultFixtures.withLvefV1.predictions,
          LVEF: {
            presentable: true,
            values: [
              { ...cathEfResultFixtures.withLvefV1.predictions.LVEF.values[0], ...override },
            ],
          },
        },
      })
    ).toBeNull();
  });

  test.each([
    ['empty values', { presentable: true, values: [] }],
    ['invalid presentable flag', { presentable: 'yes', values: [{ seriesNumber: 1, value: 50 }] }],
  ])('rejects an invalid LVEF block with %s', (_name, LVEF) => {
    expect(
      parseCathEfResultPayload({
        ...cathEfResultFixtures.withLvefV1,
        predictions: { ...cathEfResultFixtures.withLvefV1.predictions, LVEF },
      })
    ).toBeNull();
  });

  test('rejects invalid recommendation metadata', () => {
    expect(
      parseCathEfResultPayload({
        ...cathEfResultFixtures.withLvefV1,
        modelRecommendations: {
          ...cathEfResultFixtures.withLvefV1.modelRecommendations,
          presentable: 'yes',
        },
      })
    ).toBeNull();
  });

  test('contains no patient or study identifiers in its fixtures', () => {
    expect(JSON.stringify(cathEfResultFixtures).toLowerCase()).not.toMatch(
      /patient|mrn|studyinstanceuid|study_uid/
    );
  });
});
