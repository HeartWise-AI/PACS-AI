import type { DeepCoroSyntaxResultPayload } from './deepCoroSyntaxContract';

export const deepCoroSyntaxResultFixtures = {
  validV5: {
    diagnosis: 'Synthetic modified SYNTAX result for component testing.',
    predictions: {
      syntax: { value: 24.5, unit: 'points', band: 'Intermediate (23-32)', bandIndex: 2 },
      territory: { left: 17.2, right: 7.3, unit: 'points' },
      severityHead: {
        class: '23-32',
        probabilities: { '0': 0.03, '1-22': 0.17, '23-32': 0.68, '>=33': 0.12 },
      },
      intermediateToHigh: {
        positive: true,
        threshold: 16.902657,
        note: 'Synthetic model-authored note that must not be displayed.',
      },
    },
    modelRecommendations: {
      en: '<strong>Synthetic recommendation that must not be displayed.</strong>',
      fr: '<strong>Recommandation synthétique qui ne doit pas être affichée.</strong>',
    },
  } satisfies DeepCoroSyntaxResultPayload,
};
