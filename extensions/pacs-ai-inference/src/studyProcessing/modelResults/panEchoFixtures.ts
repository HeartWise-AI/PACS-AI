// Synthetic values only. These fixtures are unrelated to a patient or deployed result.
export const panEchoResultFixtures = {
  successfulV1: {
    diagnosis: JSON.stringify({
      'Left ventricular (LV) ejection fraction': '58.4 % (Normal)',
      'Global longitudinal strain': '17.2 % (Borderline)',
      'LV systolic function': 'Normal|Hyperdynamic',
      'Right ventricular (RV) systolic pressure': '42.0 mmHg (Mild Pulmonary Hypertension)',
      'RV systolic function': 'Normal',
      'Aortic valve stenosis': 'None',
      'Mitral valve regurgitation': 'Mild',
      'Pericardial effusion': 'none_trace',
    }),
    predictions: {
      'Left ventricular (LV) ejection fraction': 58.4,
      'Global longitudinal strain': 17.2,
      'LV systolic function': [0.03, 0.08, 0.89],
      'Right ventricular (RV) systolic pressure': 42,
      'RV systolic function': [0.12, 0.88],
      'Aortic valve stenosis': [0.08, 0.87, 0.05],
      'Mitral valve regurgitation': [0.73, 0.12, 0.15],
      'Pericardial effusion': 0.06,
    },
    modelRecommendations: {
      en: 'Synthetic recommendation for component testing.',
      fr: 'Recommandation synthétique pour les tests de composant.',
      presentable: true,
    },
  },
  partialV1: {
    diagnosis: JSON.stringify({
      'Left ventricular (LV) ejection fraction': '37.6 % (Moderately Abnormal)',
      'LV systolic function': 'Moderately|Severely Decreased',
      'Future echo classification': 'Indeterminate',
    }),
    predictions: {
      'Left ventricular (LV) ejection fraction': 37.6,
      'LV systolic function': null,
      'Future echo measurement': 12.25,
    },
    modelRecommendations: null,
  },
} satisfies Record<string, unknown>;
