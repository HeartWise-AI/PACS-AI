import {
  DEEP_CORO_CLIP_ARTERIES,
  type DeepCoroClipPrediction,
  type DeepCoroClipResultPayload,
} from './deepCoroClipContract';

// Synthetic values only. This fixture is intentionally unrelated to a patient or deployed result.
const predictions = Object.fromEntries(
  DEEP_CORO_CLIP_ARTERIES.map((artery, index) => [
    artery,
    {
      regression: Number(((index * 4.7 + 3.1) % 100).toFixed(1)),
      stenosis_prob: Number(((index * 0.037 + 0.08) % 1).toFixed(3)),
      diagnosis_stenosis: 'normal',
      calcif_prob: Number(((index * 0.029 + 0.04) % 1).toFixed(3)),
      diagnosis_calcif: 'normal',
      cto_prob: Number(((index * 0.017 + 0.02) % 1).toFixed(3)),
      diagnosis_cto: 'normal',
      thrombus_prob: Number(((index * 0.011 + 0.01) % 1).toFixed(3)),
      diagnosis_thrombus: 'normal',
    } satisfies DeepCoroClipPrediction,
  ])
) as Record<(typeof DEEP_CORO_CLIP_ARTERIES)[number], DeepCoroClipPrediction>;

predictions['Proximal RCA'] = {
  ...predictions['Proximal RCA'],
  regression: 62.4,
  stenosis_prob: 0.82,
  diagnosis_stenosis: 'blocked',
  calcif_prob: 0.73,
  diagnosis_calcif: 'calcified',
};

predictions['Mid LAD'] = {
  ...predictions['Mid LAD'],
  cto_prob: 0.71,
  diagnosis_cto: 'cto',
};

predictions['Distal LCX'] = {
  ...predictions['Distal LCX'],
  thrombus_prob: 0.68,
  diagnosis_thrombus: 'thrombus',
};

export const deepCoroClipResultFixtures = {
  validV1: {
    diagnosis: 'Synthetic DeepCORO-CLIP result for component testing.',
    predictions,
    modelRecommendations: {
      en: 'Synthetic English recommendation for component testing.',
      fr: 'Recommandation française synthétique pour les tests de composant.',
      presentable: true,
    },
  },
} satisfies Record<string, DeepCoroClipResultPayload>;
