import type { CathEfClipResultPayload } from './cathEfClipContract';

// Synthetic values only. These fixtures are intentionally unrelated to a patient or deployed result.
export const cathEfClipResultFixtures = {
  reducedV1: {
    diagnosis: 'Synthetic reduced EF result that must not be displayed.',
    predictions: {
      LVEF: { value: 37.4, unit: '%' },
      reducedEF: { probability: 0.782, threshold: 0.5, diagnosis: 'reduced' },
    },
    modelRecommendations: {
      en: '<strong>Synthetic recommendation that must not be displayed.</strong>',
      fr: '<strong>Recommandation synthétique qui ne doit pas être affichée.</strong>',
      presentable: true,
    },
  },
  preservedV1: {
    diagnosis: 'Synthetic preserved EF result that must not be displayed.',
    predictions: {
      LVEF: { value: 58.6, unit: '%' },
      reducedEF: { probability: 0.183, threshold: 0.5, diagnosis: 'preserved' },
    },
    modelRecommendations: {
      en: 'Synthetic recommendation that must not be displayed.',
      fr: 'Recommandation synthétique qui ne doit pas être affichée.',
      presentable: true,
    },
  },
} satisfies Record<string, CathEfClipResultPayload>;
