// Synthetic values only. These fixtures are unrelated to a patient or deployed result.
export const echoPrimeResultFixtures = {
  successfulV1: {
    diagnosis:
      'Left Ventricle: Normal left ventricular size. LV ejection fraction is 59%.[SEP]Right Ventricle: Normal right ventricular systolic function.[SEP]Mitral Valve: Mild leaflet thickening.',
    predictions: {
      ejection_fraction: 59,
      pulmonary_artery_pressure_continuous: 22.5,
      wall_motion_hypokinesis: 0.12,
      left_atrium_dilation: 0.21,
      right_ventricle_dilation: 0.05,
      mitral_regurgitation: 0.08,
      aortic_regurgitation: 0.04,
    },
    modelRecommendations: { en: null, fr: null, presentable: true },
  },
  partialV1: {
    diagnosis: 'Left Ventricle: Limited synthetic report section.[SEP]',
    predictions: {
      ejection_fraction: null,
      mitral_regurgitation: 0.03,
      future_echo_metric: 0.44,
      unknown_nested_value: { unavailable: true },
    },
    modelRecommendations: null,
  },
} satisfies Record<string, unknown>;
