import type { DeepRVClipResultPayload } from './deepRVClipContract';

// Synthetic values only. This fixture is intentionally unrelated to a patient or deployed result.
export const deepRVClipResultFixtures = {
  validV1: {
    diagnosis: 'Synthetic DeepRV-CLIP result for component testing.',
    predictions: {
      abnormalRV: {
        probability: 0.124,
        threshold: 0.5,
        diagnosis: 'normal',
      },
    },
    modelRecommendations: {
      en: 'Synthetic English recommendation for component testing.',
      fr: 'Recommandation française synthétique pour les tests de composant.',
      presentable: true,
    },
  },
} satisfies Record<string, DeepRVClipResultPayload>;
