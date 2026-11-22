import { CARDIO_SYNTAX_TERRITORIES, parseCardioSyntaxResultPayload } from './cardioSyntaxContract';
import { cardioSyntaxResultFixtures } from './cardioSyntaxFixtures';

describe('CardioSyntax result contract', () => {
  test('accepts the de-identified deployed 1.0.0 payload shape', () => {
    expect(parseCardioSyntaxResultPayload(cardioSyntaxResultFixtures.validV1)).toEqual(
      cardioSyntaxResultFixtures.validV1
    );
  });

  test('keeps only approved contract fields when additional data is present', () => {
    const parsed = parseCardioSyntaxResultPayload({
      ...cardioSyntaxResultFixtures.validV1,
      futureTopLevelField: '<script>not executable</script>',
      predictions: {
        ...cardioSyntaxResultFixtures.validV1.predictions,
        'Future Territory': { regression: 99, category: 'severe' },
      },
    });

    expect(parsed).toEqual(cardioSyntaxResultFixtures.validV1);
    expect(parsed).not.toHaveProperty('futureTopLevelField');
    expect(parsed?.predictions).not.toHaveProperty('Future Territory');
  });

  test.each(CARDIO_SYNTAX_TERRITORIES)(
    'rejects a payload missing the required %s prediction',
    territory => {
      const predictions: Record<string, unknown> = {
        ...cardioSyntaxResultFixtures.validV1.predictions,
      };
      delete predictions[territory];

      expect(
        parseCardioSyntaxResultPayload({
          ...cardioSyntaxResultFixtures.validV1,
          predictions,
        })
      ).toBeNull();
    }
  );

  test.each([
    ['empty predictions', { predictions: {} }],
    [
      'non-finite score',
      {
        predictions: {
          ...cardioSyntaxResultFixtures.validV1.predictions,
          'Global Cardiac Syntax': { regression: Number.NaN, category: 'moderate' },
        },
      },
    ],
    [
      'unknown category',
      {
        predictions: {
          ...cardioSyntaxResultFixtures.validV1.predictions,
          'Global Cardiac Syntax': { regression: 24.5, category: 'unexpected' },
        },
      },
    ],
    [
      'score below the documented range',
      {
        predictions: {
          ...cardioSyntaxResultFixtures.validV1.predictions,
          'Global Cardiac Syntax': { regression: -0.1, category: 'no_disease' },
        },
      },
    ],
    [
      'score above the documented range',
      {
        predictions: {
          ...cardioSyntaxResultFixtures.validV1.predictions,
          'Global Cardiac Syntax': { regression: 100.1, category: 'severe' },
        },
      },
    ],
    ['missing recommendations', { modelRecommendations: null }],
    [
      'invalid recommendation metadata',
      {
        modelRecommendations: {
          ...cardioSyntaxResultFixtures.validV1.modelRecommendations,
          presentable: 'yes',
        },
      },
    ],
  ])('rejects %s', (_name, override) => {
    expect(
      parseCardioSyntaxResultPayload({ ...cardioSyntaxResultFixtures.validV1, ...override })
    ).toBeNull();
  });

  test('contains no patient or study identifiers in its fixture', () => {
    const fixtureText = JSON.stringify(cardioSyntaxResultFixtures).toLowerCase();

    expect(fixtureText).not.toMatch(/patient|mrn|studyinstanceuid|study_uid/);
  });
});
