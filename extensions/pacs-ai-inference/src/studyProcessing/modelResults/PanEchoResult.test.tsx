import React from 'react';
import { render } from '@testing-library/react';
import { PanEchoResult } from './PanEchoResult';
import { parsePanEchoResultPayload } from './panEchoContract';
import { panEchoResultFixtures } from './panEchoFixtures';
import { parseEchoSrResultPayload } from './echoSrContract';
import { echoSrResultFixtures } from './echoSrFixtures';

let mockLanguage = 'en-US';
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) =>
      String(options.defaultValue ?? '').replace(/\{\{(\w+)\}\}/g, (_m, name) => String(options[name] ?? '')),
    i18n: { language: mockLanguage },
  }),
}));

afterEach(() => {
  mockLanguage = 'en-US';
});

const sectionIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-testid^="echo-report-section-"]'))
    .map(element => element.getAttribute('data-testid'))
    .filter(id => id && !id.endsWith('-title'));

const conclusion = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-testid="echo-report-conclusion-item"]')).map(
    element => element.textContent
  );

const calibratedPayload = (label: string) => ({
  diagnosis: JSON.stringify({
    'Aortic valve stenosis': `${label} (MHI-calibrated screening, not a diagnosis): P(severe AS) 0.19, P(any AS) 0.54`,
    'Aortic valve peak velocity': '3.6 m/s (AI estimate, MHI-calibrated; uncorrected 2.7 m/s)',
    'Left ventricular (LV) ejection fraction': '60.0 % (Normal)',
    'Mitral valve regurgitation': 'Moderate|Severe',
  }),
  predictions: {
    'Aortic valve stenosis': [0.35, 0.46, 0.19],
    'Aortic valve peak velocity': 3.6,
    'Aortic valve peak velocity (uncorrected)': 2.7,
    'Left ventricular (LV) ejection fraction': 60,
    'Mitral valve regurgitation': [0.2, 0.6, 0.2],
  },
});

describe('PanEchoResult structured report', () => {
  test.each(['successfulV1', 'partialV1'] as const)('renders the %s fixture by structure', fixture => {
    const payload = parsePanEchoResultPayload(panEchoResultFixtures[fixture])!;
    const { container } = render(
      <PanEchoResult payload={payload} modelName="PanEcho" modelVersion="1.0.0" status="completed" />
    );
    expect(container.querySelectorAll('[data-testid="panecho-result"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="echo-structured-report"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="echo-report-conclusion"]')).not.toBeNull();
    expect(container.textContent).toContain('Completed');
  });

  test('sections follow echo order with measured rows before AI rows, AV as one valve subsection', () => {
    const payload = parsePanEchoResultPayload(calibratedPayload('Significant AS likely'))!;
    const measured = parseEchoSrResultPayload(echoSrResultFixtures.severeGe)!;
    const { container } = render(
      <PanEchoResult payload={payload} measured={measured} patientSex="F" modelName="PanEcho" modelVersion="1.1.3" status="completed" />
    );
    const ids = sectionIds(container);
    const order = ['lv', 'rv', 'atria', 'av', 'mv', 'tv', 'pv', 'aorta', 'other'];
    const present = order.filter(id => ids.includes(`echo-report-section-${id}`));
    expect(ids).toEqual(present.map(id => `echo-report-section-${id}`));
    expect(ids).toContain('echo-report-section-lv');
    expect(ids).toContain('echo-report-section-av');
    expect(container.querySelector('[data-testid="echo-report-group-valves"]')).not.toBeNull();

    const av = container.querySelector('[data-testid="echo-report-section-av"]')!;
    const blocks = Array.from(av.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid'));
    // Measured AS grade first, then measured AV values, then the AI screening.
    expect(blocks.indexOf('echo-report-as-grade')).toBeGreaterThanOrEqual(0);
    expect(blocks.indexOf('echo-report-as-grade')).toBeLessThan(blocks.indexOf('echo-report-measured-av'));
    expect(blocks.indexOf('echo-report-measured-av')).toBeLessThan(blocks.indexOf('echo-report-as-screening'));
    expect(av.querySelector('[data-testid="echo-report-as-grade"]')?.getAttribute('data-grade')).toBe('severe');
    expect(av.querySelector('[data-testid="echo-report-as-calibrated"]')?.textContent).toContain('Significant AS likely');
    expect(av.textContent).toContain('Screening label, not a diagnosis');
    expect(av.querySelector('[data-testid="echo-report-as-vmax-uncorrected"]')?.textContent).toContain('2.7');

    const lv = container.querySelector('[data-testid="echo-report-section-lv"]')!;
    const lvBlocks = Array.from(lv.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid'));
    if (lvBlocks.includes('echo-report-measured-lv')) {
      expect(lvBlocks.indexOf('echo-report-measured-lv')).toBeLessThan(lvBlocks.indexOf('echo-report-ai-lv'));
    }
    // The conclusion is the last block and lists the measured severe AS first for the AV.
    const report = container.querySelector('[data-testid="echo-structured-report"]')!;
    expect(report.lastElementChild?.getAttribute('data-testid')).toBe('echo-report-conclusion');
    const items = conclusion(container);
    expect(items.some(text => text?.startsWith('Aortic valve — Severe aortic stenosis (measured:'))).toBe(true);
    expect(items.some(text => text?.startsWith('Mitral valve — Moderate or severe mitral regurgitation (AI estimate'))).toBe(true);
  });

  test('the standalone AS block and the measured block at the top are gone', () => {
    const payload = parsePanEchoResultPayload(calibratedPayload('No significant AS suspected'))!;
    const { container } = render(
      <PanEchoResult payload={payload} modelName="PanEcho" modelVersion="1.1.3" status="completed" />
    );
    expect(container.querySelector('[data-testid="panecho-as-screening"]')).toBeNull();
    expect(container.querySelector('[data-testid="echo-sr-compact"]')).toBeNull();
    expect(container.textContent).not.toContain('Aortic stenosis: AI screening scores');
    // The AS screening lives in the aortic valve subsection.
    const av = container.querySelector('[data-testid="echo-report-section-av"]')!;
    expect(av.querySelector('[data-testid="echo-report-as-screening"]')).not.toBeNull();
  });

  test('1.1.2 screening scores have no calibrated label and the uncalibrated caveat', () => {
    const payload = parsePanEchoResultPayload({
      diagnosis: JSON.stringify({
        'Aortic valve stenosis': 'Screening score, not a diagnosis: P(severe AS) 0.20, P(any AS) 0.57',
      }),
      predictions: { 'Aortic valve stenosis': [0.37, 0.43, 0.2], 'Aortic valve peak velocity': 2.4 },
    })!;
    const { container } = render(
      <PanEchoResult payload={payload} modelName="PanEcho" modelVersion="1.1.2" status="completed" />
    );
    expect(container.querySelector('[data-testid="echo-report-as-calibrated"]')).toBeNull();
    expect(container.querySelector('[data-testid="echo-report-as-severe"]')?.textContent).toContain('20 %');
    expect(container.querySelector('[data-testid="echo-report-as-any"]')?.textContent).toContain('57 %');
    expect(container.textContent).toContain('Screening scores, not a diagnosis');
    // An uncalibrated screening score is never a positive finding.
    expect(container.querySelector('[data-testid="echo-report-no-abnormality"]')?.textContent).toBe(
      'No significant abnormality detected (measured + AI)'
    );
  });

  test('French strings come from the report config', () => {
    mockLanguage = 'fr';
    const payload = parsePanEchoResultPayload(calibratedPayload('Significant AS likely'))!;
    const measured = parseEchoSrResultPayload(echoSrResultFixtures.severeGe)!;
    const { container } = render(
      <PanEchoResult payload={payload} measured={measured} modelName="PanEcho" modelVersion="1.1.3" status="completed" />
    );
    expect(container.textContent).toContain('Conclusion / Résultats pertinents');
    expect(container.textContent).toContain('Valve aortique');
    expect(conclusion(container).some(text => text?.startsWith('Valve aortique — Sténose aortique sévère (mesuré'))).toBe(true);
  });
});
