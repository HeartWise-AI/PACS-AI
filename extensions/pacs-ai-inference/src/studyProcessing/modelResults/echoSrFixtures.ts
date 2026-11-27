// Synthetic values only, in the echo-sr-measurements/1 shape. Unrelated to any patient.
const gradingNote =
  "Derived from the sonographer's measured Doppler values in the echo SR by guideline thresholds; not a physician interpretation. Does not account for prosthetic valves or flow state.";
const guideline = 'ASE/EACVI 2017; ACC/AHA 2020 (Vmax, mean gradient; AVA noted)';
const rules = {
  repeated:
    'Values the sonographer chose on the machine (Selection Status) win over the individual samples. Peak velocities and gradients: maximum. Other measurements: most recent SR, mean of its values.',
  units: 'velocity m/s (tissue Doppler cm/s), length cm, area cm2, volume ml, pressure mmHg',
  asGrading: guideline,
};

export const echoSrResultFixtures = {
  severeGe: {
    schema: 'echo-sr-measurements/1',
    source: {
      kind: 'dicom-sr',
      srCount: 1,
      documents: [
        {
          manufacturer: 'GE Vingmed Ultrasound',
          model: 'Vivid E95',
          template: '5200',
          measurementCount: 12,
        },
      ],
    },
    measurements: [
      {
        site: 'Aortic Valve',
        measurement: 'Peak Velocity',
        code: '11726-7',
        mode: 'Doppler Continuous Wave',
        flowDirection: 'Antegrade Flow',
        value: 4.31,
        unit: 'm/s',
        samples: 3,
        rule: 'chosen, max',
      },
      {
        site: 'Aortic Valve',
        measurement: 'Mean Gradient',
        code: '20256-4',
        mode: 'Doppler Continuous Wave',
        flowDirection: 'Antegrade Flow',
        value: 46.2,
        unit: 'mmHg',
        samples: 1,
        rule: 'chosen, max',
      },
      {
        site: 'Left Ventricle',
        measurement: 'Left Ventricular Ejection Fraction',
        code: '18043-0',
        method: 'Method of Disks, Biplane',
        value: 55,
        unit: '%',
        samples: 1,
        rule: 'chosen',
      },
    ],
    summary: {
      avVmax: {
        value: 4.31,
        unit: 'm/s',
        mode: 'Doppler Continuous Wave',
        site: 'Aortic Valve',
        rule: 'chosen, max',
      },
      avMeanGradient: {
        value: 46.2,
        unit: 'mmHg',
        mode: 'Doppler Continuous Wave',
        site: 'Aortic Valve',
      },
      avPeakGradient: {
        value: 74.3,
        unit: 'mmHg',
        mode: 'Doppler Continuous Wave',
        site: 'Aortic Valve',
      },
      ava: {
        value: 0.71,
        unit: 'cm2',
        method: 'Continuity Equation by Velocity Time Integral',
        site: 'Aortic Valve',
      },
      lvotDiameter: {
        value: 2.1,
        unit: 'cm',
        mode: '2D mode',
        site: 'Left Ventricle Outflow Tract',
      },
      lvotVti: {
        value: 20.4,
        unit: 'cm',
        mode: 'Doppler Pulsed',
        site: 'Left Ventricle Outflow Tract',
      },
      lvef: {
        value: 55,
        unit: '%',
        method: 'Method of Disks, Biplane',
        otherMethods: [{ method: 'Teichholz', value: 62 }],
      },
      trPeakGradient: { value: 31, unit: 'mmHg', site: 'Tricuspid Valve' },
      mvEA: { value: 0.8, unit: '' },
      eOverEPrime: { value: 13.4, unit: '' },
    },
    asGrading: {
      grade: 'severe',
      label: 'Severe AS (measured)',
      labelFr: 'Sténose aortique sévère (mesurée)',
      basis: ['AV Vmax 4.31 m/s', 'AV mean gradient 46 mmHg'],
      derivedFrom: 'measurements',
      guideline,
      note: gradingNote,
      ava: { value: 0.71, unit: 'cm2' },
      avaNote: 'AVA 0.71 cm2 < 1.0 cm2',
    },
    diagnosis: {
      'AV peak velocity (Vmax)': '4.31 m/s',
      'Aortic stenosis (derived from measurements)': 'Severe AS (measured)',
    },
    rules,
  },
  normal: {
    schema: 'echo-sr-measurements/1',
    source: {
      kind: 'dicom-sr',
      srCount: 1,
      documents: [
        {
          manufacturer: 'GE Vingmed Ultrasound',
          model: 'Vivid E95',
          template: '5200',
          measurementCount: 8,
        },
      ],
    },
    measurements: [],
    summary: {
      avVmax: { value: 1.29, unit: 'm/s', mode: 'Doppler Continuous Wave', site: 'Aortic Valve' },
      avPeakGradient: {
        value: 6.7,
        unit: 'mmHg',
        mode: 'Doppler Continuous Wave',
        site: 'Aortic Valve',
      },
      lvotDiameter: { value: 1.95, unit: 'cm', site: 'Left Ventricle Outflow Tract' },
      lvef: { value: 63, unit: '%', method: 'Teichholz' },
    },
    asGrading: {
      grade: 'none',
      label: 'No AS by Doppler (measured)',
      labelFr: 'Pas de sténose aortique au Doppler (mesuré)',
      basis: ['AV Vmax 1.29 m/s'],
      derivedFrom: 'measurements',
      guideline,
      note: gradingNote,
    },
    diagnosis: { 'AV peak velocity (Vmax)': '1.29 m/s' },
    rules,
  },
  discordant: {
    schema: 'echo-sr-measurements/1',
    source: {
      kind: 'dicom-sr',
      srCount: 2,
      documents: [
        {
          manufacturer: 'Philips Medical Systems',
          model: 'EPIQ CVxi',
          template: '5200',
          measurementCount: 20,
        },
        {
          manufacturer: 'Philips Medical Systems',
          model: 'EPIQ CVxi',
          template: '5200',
          measurementCount: 4,
        },
      ],
    },
    measurements: [],
    summary: {
      avVmax: { value: 3.87, unit: 'm/s', site: 'Aortic Valve' },
      avMeanGradient: { value: 39.4, unit: 'mmHg', site: 'Aortic Valve' },
      ava: { value: 0.7, unit: 'cm2', method: 'Continuity Equation by Velocity Time Integral' },
    },
    asGrading: {
      grade: 'moderate',
      label: 'Moderate AS, AVA < 1.0 cm2 (measured, discordant)',
      labelFr: 'Sténose aortique modérée, surface < 1,0 cm2 (mesurée, discordante)',
      basis: ['AV Vmax 3.87 m/s', 'AV mean gradient 39 mmHg'],
      derivedFrom: 'measurements',
      guideline,
      note: gradingNote,
      ava: { value: 0.7, unit: 'cm2' },
      avaNote:
        'AVA 0.70 cm2 < 1.0 cm2 with non-severe Vmax and mean gradient: discordant grading, consider low-flow, low-gradient AS',
      discordant: true,
    },
    diagnosis: {},
    rules,
  },
} as const;
