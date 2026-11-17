import { parseDeepCoroSyntaxResultPayload } from './deepCoroSyntaxContract';
import { deepCoroSyntaxResultFixtures } from './deepCoroSyntaxFixtures';

describe('DeepCORO-SYNTAX result contract', () => {
  test('accepts and sanitizes the deployed 5.0.0 payload', () => {
    const parsed = parseDeepCoroSyntaxResultPayload({
      ...deepCoroSyntaxResultFixtures.validV5,
      patientId: 'must-not-survive',
    });
    expect(parsed).toEqual(deepCoroSyntaxResultFixtures.validV5);
    expect(parsed).not.toHaveProperty('patientId');
  });

  test.each([
    [
      'score outside range',
      { syntax: { ...deepCoroSyntaxResultFixtures.validV5.predictions.syntax, value: 101 } },
    ],
    [
      'invalid unit',
      { syntax: { ...deepCoroSyntaxResultFixtures.validV5.predictions.syntax, unit: '%' } },
    ],
    ['missing territory', { territory: undefined }],
    [
      'invalid severity probability',
      {
        severityHead: {
          ...deepCoroSyntaxResultFixtures.validV5.predictions.severityHead,
          probabilities: {
            ...deepCoroSyntaxResultFixtures.validV5.predictions.severityHead.probabilities,
            '23-32': 1.1,
          },
        },
      },
    ],
    [
      'invalid threshold state',
      { intermediateToHigh: { positive: 'yes', threshold: 16.9, note: 'x' } },
    ],
  ])('rejects %s', (_name, predictionOverride) => {
    expect(
      parseDeepCoroSyntaxResultPayload({
        ...deepCoroSyntaxResultFixtures.validV5,
        predictions: {
          ...deepCoroSyntaxResultFixtures.validV5.predictions,
          ...predictionOverride,
        },
      })
    ).toBeNull();
  });

  test('contains no patient or study identifiers in its fixture', () => {
    const text = JSON.stringify(deepCoroSyntaxResultFixtures).toLowerCase();
    expect(text).not.toMatch(/patient|studyinstanceuid|accession/);
  });
});
