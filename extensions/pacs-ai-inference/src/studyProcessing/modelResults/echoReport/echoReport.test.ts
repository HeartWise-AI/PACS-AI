import { buildConclusion, buildReport, conclusionLines, gradeValue, routeSrMeasurement, ECHO_REPORT_CONFIG } from './echoReport';
import type { AiFinding, MeasuredFinding } from './echoReport';

describe('SR routing by Finding Site', () => {
  test.each([
    [{ site: 'Tricuspid Valve', measurement: 'Tricuspid Annular Plane Systolic Excursion (TAPSE)' }, 'rv'],
    [{ site: 'Tricuspid Valve', measurement: 'Peak Gradient' }, 'tv'],
    [{ site: 'Mitral Valve', measurement: 'Mitral Valve E-Wave Peak Velocity' }, 'lv'],
    [{ site: 'Mitral Valve', measurement: 'Mitral Valve A-Wave Peak Velocity' }, 'lv'],
    [{ site: 'Mitral Valve', measurement: 'Mitral Valve E to A Ratio' }, 'lv'],
    [{ site: 'Mitral Valve', measurement: 'E Velocity to Average Annulus E Velocity' }, 'lv'],
    [{ site: 'Mitral Valve', measurement: 'Mean Gradient' }, 'mv'],
    [{ site: 'Medial Mitral Annulus', measurement: 'Peak Tissue Velocity' }, 'lv'],
    [{ site: 'Left Ventricle Outflow Tract', measurement: 'Peak Velocity' }, 'lv'],
    [{ site: 'left ventricle basal anterior segment', measurement: 'Peak Systolic Strain' }, 'lv'],
    [{ site: 'Right Ventricle', measurement: 'Peak Tissue Velocity' }, 'rv'],
    [{ site: 'Left Atrium', measurement: 'Left Atrium Systolic Volume' }, 'atria'],
    [{ site: 'Vena Cava', measurement: 'Inferior Vena Cava Diameter' }, 'atria'],
    [{ site: 'Aortic Valve', measurement: 'Peak Velocity' }, 'av'],
    [{ site: 'Pulmonic Valve', measurement: 'Peak Gradient' }, 'pv'],
    [{ site: 'Aorta', measurement: 'Ascending Aortic Diameter' }, 'aorta'],
    [{ site: 'Descending Aorta', measurement: 'Peak Velocity' }, 'aorta'],
    [{ site: 'Unspecified', measurement: 'LV Wall Motion Score Index' }, 'lv'],
    [{ site: 'Vena Contracta', measurement: 'Diameter' }, 'other'],
    [{ site: 'Patient', measurement: 'Body Surface Area' }, null],
    [{ site: 'Unspecified', measurement: 'Subject Age' }, null],
  ])('%j -> %s', (entry, section) => {
    expect(routeSrMeasurement(entry)).toBe(section);
  });
});

describe('grading', () => {
  const lvh = ECHO_REPORT_CONFIG.measuredRules.find((r: { id: string }) => r.id === 'lvh');
  test('sex-specific cut-offs, male when unknown, compared as displayed', () => {
    expect(gradeValue(lvh, 0.96, 'female', 1)).toBe(1); // 1.0 > 0.9
    expect(gradeValue(lvh, 0.96, 'male', 1)).toBe(0);
    expect(gradeValue(lvh, 0.96, null, 1)).toBe(0);
    expect(gradeValue(lvh, 1.04, 'male', 1)).toBe(0); // shown 1.0
    expect(gradeValue(lvh, 1.45, 'male', 1)).toBe(2);
  });
});

function measured(partial: Partial<MeasuredFinding>): MeasuredFinding {
  return {
    ruleId: 'x', concept: 'lvSystolic', structure: 'lv', positive: false, level: 0, label: null,
    values: { en: 'LVEF 60 %', fr: 'FEVG 60 %' }, ...partial,
  };
}
function ai(partial: Partial<AiFinding>): AiFinding {
  return { key: 'k', kind: 'multiclass', concept: 'lvSystolic', structure: 'lv', positive: false, text: null, ...partial };
}

describe('conclusion', () => {
  test('only positives, grouped by structure in echo order, measured before AI', () => {
    const { items } = buildConclusion(
      [
        measured({ concept: 'as', structure: 'av', positive: true, level: 3, label: { en: 'Severe aortic stenosis', fr: 'SA sévère' }, values: { en: 'Vmax 4.81 m/s', fr: 'Vmax 4,81 m/s' } }),
        measured({ concept: 'lvSystolic', structure: 'lv', positive: false }),
        measured({ concept: 'lvh', structure: 'lv', positive: true, level: 1, label: { en: 'Mild LV hypertrophy (wall thickness)', fr: 'HVG légère' }, values: { en: 'IVSd 1.2 cm', fr: 'SIVd 1,2 cm' } }),
      ],
      [
        ai({ concept: 'mr', structure: 'mv', positive: true, text: { en: 'Moderate or severe mitral regurgitation', fr: 'IM' }, probability: 0.55 }),
        ai({ concept: 'wma', structure: 'lv', positive: true, text: { en: 'Regional wall motion abnormality', fr: 'ACS' }, probability: 0.6 }),
        ai({ concept: 'tr', structure: 'tv', positive: false }),
      ]
    );
    expect(items.map(i => i.line.en)).toEqual([
      'Left ventricle — Mild LV hypertrophy (wall thickness) (measured: IVSd 1.2 cm)',
      'Left ventricle — Regional wall motion abnormality (AI estimate, 60 %)',
      'Aortic valve — Severe aortic stenosis (measured: Vmax 4.81 m/s)',
      'Mitral valve — Moderate or severe mitral regurgitation (AI estimate, 55 %)',
    ]);
  });

  test('measured wins over AI: AI-negative is noted as discordant; measured-normal AI-positive becomes a section note', () => {
    const { items, notes } = buildConclusion(
      [
        measured({ concept: 'lvSystolic', structure: 'lv', positive: true, level: 2, label: { en: 'Moderately reduced LVEF', fr: 'FEVG modérément réduite' }, values: { en: 'LVEF 35 %', fr: 'FEVG 35 %' } }),
        measured({ concept: 'laSize', structure: 'la', positive: false, values: { en: 'LAVI 25 mL/m²', fr: 'VOGi 25 mL/m²' } }),
      ],
      [
        ai({ concept: 'lvSystolic', positive: false }),
        ai({ concept: 'laSize', structure: 'la', positive: true, text: { en: 'Moderate or severe LA enlargement', fr: 'OG' }, probability: 0.9 }),
      ]
    );
    expect(items).toHaveLength(1);
    expect(items[0].line.en).toBe(
      'Left ventricle — Moderately reduced LVEF (measured: LVEF 35 %) (discordant: not flagged by the AI estimate)'
    );
    expect(items[0].discordant).toBe(true);
    expect(notes).toHaveLength(1);
    expect(notes[0].section).toBe('atria');
    expect(notes[0].text.en).toContain('measured values are normal (LAVI 25 mL/m²)');
  });

  test('no positive finding gives the no-abnormality line', () => {
    const report = buildReport('PanEcho', { diagnosis: JSON.stringify({ 'LV size': 'Normal' }), predictions: { 'LV size': [0.01, 0.01, 0.98] } });
    expect(report.noAbnormality).toBe(true);
    expect(conclusionLines(report, 'en')).toEqual(['No significant abnormality detected (measured + AI)']);
    expect(conclusionLines(report, 'fr')).toEqual(['Aucune anomalie significative détectée (mesures + IA)']);
  });
});
