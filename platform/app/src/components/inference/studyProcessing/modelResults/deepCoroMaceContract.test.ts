import {
  DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS,
  DEEP_CORO_MACE_PRIMARY_ENDPOINTS,
  parseDeepCoroMaceResultPayload,
} from './deepCoroMaceContract';
import { deepCoroMaceResultFixtures } from './deepCoroMaceFixtures';

describe('DeepCORO-MACE result contract', () => {
  test('accepts and sanitizes the synthetic deployed 1.0.0 payload shape', () => {
    expect(parseDeepCoroMaceResultPayload(deepCoroMaceResultFixtures.validV1)).toEqual(
      deepCoroMaceResultFixtures.parsedV1
    );
  });

  test('keeps only approved endpoint fields', () => {
    const parsed = parseDeepCoroMaceResultPayload({
      ...deepCoroMaceResultFixtures.validV1,
      futureTopLevelField: 'ignored',
      predictions: {
        ...deepCoroMaceResultFixtures.validV1.predictions,
        primary: {
          ...deepCoroMaceResultFixtures.validV1.predictions.primary,
          compositeMace: {
            ...deepCoroMaceResultFixtures.validV1.predictions.primary.compositeMace,
            futureEndpointField: 'ignored',
          },
        },
      },
    });

    expect(parsed).toEqual(deepCoroMaceResultFixtures.parsedV1);
    expect(parsed).not.toHaveProperty('futureTopLevelField');
    expect(parsed?.predictions.primary.compositeMace).not.toHaveProperty('name');
    expect(parsed?.predictions.primary.compositeMace).not.toHaveProperty('futureEndpointField');
  });

  test.each([
    ...DEEP_CORO_MACE_PRIMARY_ENDPOINTS.map(key => ['primary', key] as const),
    ...DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS.map(key => ['exploratory', key] as const),
  ])('rejects a payload missing %s.%s', (group, key) => {
    const endpoints: Record<string, unknown> = {
      ...deepCoroMaceResultFixtures.validV1.predictions[group],
    };
    delete endpoints[key];

    expect(
      parseDeepCoroMaceResultPayload({
        ...deepCoroMaceResultFixtures.validV1,
        predictions: {
          ...deepCoroMaceResultFixtures.validV1.predictions,
          [group]: endpoints,
        },
      })
    ).toBeNull();
  });

  test.each([
    ['non-finite probability', { probability: Number.NaN }],
    ['probability below zero', { probability: -0.001 }],
    ['probability above one', { probability: 1.001 }],
    ['threshold below zero', { threshold: -0.001 }],
    ['threshold above one', { threshold: 1.001 }],
    ['non-boolean threshold state', { aboveResearchThreshold: 'yes' }],
    ['non-string label', { name: 42 }],
    ['non-string warning', { warning: 42 }],
  ])('rejects an endpoint with %s', (_name, override) => {
    expect(
      parseDeepCoroMaceResultPayload({
        ...deepCoroMaceResultFixtures.validV1,
        predictions: {
          ...deepCoroMaceResultFixtures.validV1.predictions,
          primary: {
            ...deepCoroMaceResultFixtures.validV1.predictions.primary,
            compositeMace: {
              ...deepCoroMaceResultFixtures.validV1.predictions.primary.compositeMace,
              ...override,
            },
          },
        },
      })
    ).toBeNull();
  });

  test.each([
    ['time horizon', { timeHorizon: '5 years' }],
    ['threshold note', { thresholdNote: null }],
  ])('rejects an invalid %s', (_name, override) => {
    expect(
      parseDeepCoroMaceResultPayload({
        ...deepCoroMaceResultFixtures.validV1,
        predictions: { ...deepCoroMaceResultFixtures.validV1.predictions, ...override },
      })
    ).toBeNull();
  });

  test('rejects invalid recommendation metadata', () => {
    expect(
      parseDeepCoroMaceResultPayload({
        ...deepCoroMaceResultFixtures.validV1,
        modelRecommendations: {
          ...deepCoroMaceResultFixtures.validV1.modelRecommendations,
          presentable: 'yes',
        },
      })
    ).toBeNull();
  });

  test('contains no patient or study identifiers in its fixture', () => {
    const fixtureText = JSON.stringify(deepCoroMaceResultFixtures).toLowerCase();
    expect(fixtureText).not.toMatch(/patient|mrn|studyinstanceuid|study_uid/);
  });
});
