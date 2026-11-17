// Synthetic values only, shaped like the output of an echocardiography model
// that stores its interpretation as a serialised JSON object. Unrelated to any
// patient or deployed result.
export const readableEchoDiagnosis: Record<string, string> = {
  'Pericardial effusion': 'none_trace',
  'Left ventricular (LV) ejection fraction': '61.5 % (Normal)',
  'Global longitudinal strain': '19.4 % (Normal)',
  'LV end-diastolic volume': '71.0 mL (Normal)',
  'LV stroke volume': '39.8 mL (Abnormal)',
  'LV size': 'Normal',
  'LV systolic function': 'Normal|Hyperdynamic',
  'Right ventricular (RV) systolic pressure': '44.0 mmHg (Mild Pulmonary Hypertension)',
  'RV size': 'Normal',
  'Left atrial (LA) size': 'Mildly Dilated',
  'LA volume': '52.3 mL (Abnormal)',
  'Right atrial (RA) size': 'Normal',
  'Elevated RA pressure': 'no',
  'Aortic valve stenosis': 'None',
  'Mitral valve regurgitation': 'mild_moderate',
  "E/e' ratio": '8.1 ratio (Normal)',
};

export const readableResultFixtures = {
  serialisedDiagnosis: { diagnosis: JSON.stringify(readableEchoDiagnosis) },
} satisfies Record<string, unknown>;
