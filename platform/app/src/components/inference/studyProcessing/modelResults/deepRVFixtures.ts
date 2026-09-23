import type { DeepRVResultPayload } from './deepRVContract';

// Synthetic values only. This fixture is intentionally unrelated to a patient or deployed result.
export const deepRVResultFixtures = {
  validV1: {
    diagnosis: 'Synthetic DeepRV result for component testing.',
    predictions: {
      probability: 0.184,
      class: 0,
    },
    modelRecommendations: {
      en: 'Synthetic English recommendation for component testing.',
      fr: 'Recommandation française synthétique pour les tests de composant.',
      presentable: true,
    },
  },
} satisfies Record<string, DeepRVResultPayload>;
