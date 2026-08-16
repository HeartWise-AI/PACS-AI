import type { CardioSyntaxResultPayload } from './cardioSyntaxContract';

// Synthetic values only. This fixture is intentionally unrelated to a patient or deployed result.
export const cardioSyntaxResultFixtures = {
  validV1: {
    diagnosis: 'Synthetic CardioSyntax result for component testing.',
    predictions: {
      'Global Cardiac Syntax': { regression: 24.5, category: 'moderate' },
      'Left Cardiac Syntax': { regression: 12.3, category: 'mild' },
      'Right Cardiac Syntax': { regression: 1.2, category: 'no_disease' },
    },
    modelRecommendations: {
      en: 'Synthetic English recommendation for component testing.',
      fr: 'Recommandation française synthétique pour les tests de composant.',
      presentable: true,
    },
  },
} satisfies Record<string, CardioSyntaxResultPayload>;
