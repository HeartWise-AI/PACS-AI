import type { DeepCoroMaceResultPayload } from './deepCoroMaceContract';

// Synthetic values only. This fixture is intentionally unrelated to a patient or deployed result.
export const deepCoroMaceResultFixtures = {
  validV1: {
    diagnosis: 'Synthetic one-year research result for component testing.',
    predictions: {
      timeHorizon: '1 year',
      primary: {
        compositeMace: {
          name: 'Synthetic model-authored composite label',
          probability: 0.624,
          threshold: 0.5,
          aboveResearchThreshold: true,
        },
        urgentRevascularization: {
          name: 'Synthetic urgent revascularization label',
          probability: 0.382,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
        nonFatalMyocardialInfarction: {
          name: 'Synthetic myocardial infarction label',
          probability: 0.511,
          threshold: 0.5,
          aboveResearchThreshold: true,
        },
        completeCoronaryOcclusion: {
          name: 'Synthetic complete occlusion label',
          probability: 0.147,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
      },
      exploratory: {
        cardiovascularDeath: {
          name: 'Synthetic cardiovascular death label',
          probability: 0.083,
          threshold: 0.5,
          aboveResearchThreshold: false,
          warning: 'Synthetic model-authored warning that must not be displayed.',
        },
        nonFatalStroke: {
          name: 'Synthetic stroke label',
          probability: 0.126,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
        heartFailureHospitalization: {
          name: 'Synthetic heart failure label',
          probability: 0.534,
          threshold: 0.5,
          aboveResearchThreshold: true,
        },
        lifeThreateningArrhythmia: {
          name: 'Synthetic arrhythmia label',
          probability: 0.209,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
        cardiogenicShock: {
          name: 'Synthetic shock label',
          probability: 0.491,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
      },
      thresholdNote: 'Synthetic model-authored threshold note that must not be displayed.',
    },
    modelRecommendations: {
      en: '<strong>Synthetic recommendation that must not be displayed.</strong>',
      fr: '<strong>Recommandation synthétique qui ne doit pas être affichée.</strong>',
      presentable: true,
    },
  },
  parsedV1: {
    diagnosis: 'Synthetic one-year research result for component testing.',
    predictions: {
      timeHorizon: '1 year',
      primary: {
        compositeMace: { probability: 0.624, threshold: 0.5, aboveResearchThreshold: true },
        urgentRevascularization: {
          probability: 0.382,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
        nonFatalMyocardialInfarction: {
          probability: 0.511,
          threshold: 0.5,
          aboveResearchThreshold: true,
        },
        completeCoronaryOcclusion: {
          probability: 0.147,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
      },
      exploratory: {
        cardiovascularDeath: {
          probability: 0.083,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
        nonFatalStroke: { probability: 0.126, threshold: 0.5, aboveResearchThreshold: false },
        heartFailureHospitalization: {
          probability: 0.534,
          threshold: 0.5,
          aboveResearchThreshold: true,
        },
        lifeThreateningArrhythmia: {
          probability: 0.209,
          threshold: 0.5,
          aboveResearchThreshold: false,
        },
        cardiogenicShock: { probability: 0.491, threshold: 0.5, aboveResearchThreshold: false },
      },
      thresholdNote: 'Synthetic model-authored threshold note that must not be displayed.',
    },
    modelRecommendations: {
      en: '<strong>Synthetic recommendation that must not be displayed.</strong>',
      fr: '<strong>Recommandation synthétique qui ne doit pas être affichée.</strong>',
      presentable: true,
    },
  } satisfies DeepCoroMaceResultPayload,
};
