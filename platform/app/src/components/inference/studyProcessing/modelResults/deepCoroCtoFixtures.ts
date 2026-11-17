import type { DeepCoroCtoResultPayload } from './deepCoroCtoContract';

const components = {
  jcto_blunt_stump: {
    name: 'Synthetic blunt stump label',
    probability: 0.32,
    threshold: 0.5,
    present: false,
  },
  jcto_calcification: {
    name: 'Synthetic calcification label',
    probability: 0.71,
    threshold: 0.5,
    present: true,
  },
  jcto_bending_gt45: {
    name: 'Synthetic bend label',
    probability: 0.64,
    threshold: 0.5,
    present: true,
  },
  jcto_occlusion_length_gt20: {
    name: 'Synthetic length label',
    probability: 0.41,
    threshold: 0.5,
    present: false,
  },
};

const artery = (jctoScore: number, jctoScoreInteger: number) => ({
  jctoScore,
  jctoScoreInteger,
  components: {
    jcto_blunt_stump: 0.32,
    jcto_calcification: 0.71,
    jcto_bending_gt45: 0.64,
    jcto_occlusion_length_gt20: 0.41,
  },
});

export const deepCoroCtoResultFixtures = {
  validV2: {
    diagnosis: 'Synthetic J-CTO result for component testing.',
    predictions: {
      jctoScore: {
        predicted: 2.1,
        predictedInteger: 2,
        componentsAboveThreshold: 2,
        difficulty: 'difficult',
      },
      components,
      ctoArtery: 'RCA',
      perArtery: { LAD: artery(0.31, 0), RCA: artery(2.1, 2), LCx: artery(0.12, 0) },
    },
    modelRecommendations: {
      en: '<strong>Synthetic recommendation that must not be displayed.</strong>',
      fr: '<strong>Recommandation synthétique qui ne doit pas être affichée.</strong>',
      presentable: true,
    },
  },
  parsedV2: {
    diagnosis: 'Synthetic J-CTO result for component testing.',
    predictions: {
      jctoScore: {
        predicted: 2.1,
        predictedInteger: 2,
        componentsAboveThreshold: 2,
        difficulty: 'difficult',
      },
      components: {
        jcto_blunt_stump: { probability: 0.32, threshold: 0.5, present: false },
        jcto_calcification: { probability: 0.71, threshold: 0.5, present: true },
        jcto_bending_gt45: { probability: 0.64, threshold: 0.5, present: true },
        jcto_occlusion_length_gt20: { probability: 0.41, threshold: 0.5, present: false },
      },
      ctoArtery: 'RCA',
      perArtery: { LAD: artery(0.31, 0), RCA: artery(2.1, 2), LCx: artery(0.12, 0) },
    },
    modelRecommendations: {
      en: '<strong>Synthetic recommendation that must not be displayed.</strong>',
      fr: '<strong>Recommandation synthétique qui ne doit pas être affichée.</strong>',
      presentable: true,
    },
  } satisfies DeepCoroCtoResultPayload,
};
