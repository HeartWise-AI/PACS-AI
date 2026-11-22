import type { CathEfResultPayload } from './cathEfContract';

// Synthetic values only. These fixtures are intentionally unrelated to a patient or deployed result.
export const cathEfResultFixtures = {
  withLvefV1: {
    predictions: {
      vessels: [
        { seriesNumber: 1, vessel: 'Left Coronary' },
        { seriesNumber: 2, vessel: 'Right Coronary' },
        { seriesNumber: 7, vessel: 'Left Coronary' },
      ],
      LVEF: {
        presentable: true,
        values: [
          { seriesNumber: 1, value: 48.3 },
          { seriesNumber: 7, value: 56.8 },
        ],
      },
    },
    modelRecommendations: {
      en: '<strong>Synthetic recommendation that must not be displayed.</strong>',
      fr: '<strong>Recommandation synthétique qui ne doit pas être affichée.</strong>',
      presentable: true,
    },
  },
  vesselOnlyV1: {
    predictions: {
      vessels: [
        { seriesNumber: 3, vessel: 'Aorta' },
        { seriesNumber: 4, vessel: 'Catheter' },
      ],
    },
    modelRecommendations: {
      en: 'No synthetic LVEF values are available.',
      fr: 'Aucune valeur synthétique de FEVG n’est disponible.',
      presentable: false,
    },
  },
} satisfies Record<string, CathEfResultPayload>;
