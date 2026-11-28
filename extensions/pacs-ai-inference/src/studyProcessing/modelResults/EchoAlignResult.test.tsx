import React from 'react';
import { render } from '@testing-library/react';
import { EchoAlignResult, getEchoAlignDisplayRows } from './EchoAlignResult';
import {
  getEchoAlignAorticScreening,
  isSupportedEchoAlignVersion,
  parseEchoAlignResultPayload,
} from './echoAlignContract';
import { echoAlignResultFixtures } from './echoAlignFixtures';
import { resolveModelResultRenderer } from './modelResultRendererRegistry';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
  }),
}));

const payload = parseEchoAlignResultPayload(echoAlignResultFixtures.severeAs)!;

describe('EchoAlign contract', () => {
  test('accepts the 0.1 release line only', () => {
    expect(isSupportedEchoAlignVersion('0.1.2')).toBe(true);
    expect(isSupportedEchoAlignVersion('0.1.10')).toBe(true);
    expect(isSupportedEchoAlignVersion('0.2.0')).toBe(false);
    expect(isSupportedEchoAlignVersion(null)).toBe(false);
  });

  test('parses heads and derives the AS screening scores from the grade head', () => {
    expect(payload.clipsUsed).toBe(55);
    const screening = getEchoAlignAorticScreening(payload)!;
    expect(screening.severe).toBeCloseTo(0.1077, 3);
    expect(screening.any).toBeCloseTo(1 - 0.1213, 2);
    expect(screening.vmaxEstimate).toBeCloseTo(3.08, 2);
    expect(parseEchoAlignResultPayload({ predictions: {} })).toBeNull();
    expect(parseEchoAlignResultPayload(null)).toBeNull();
  });

  test('is resolved to the EchoAlign template, and unsupported versions are not shown as generic', () => {
    const resolved = resolveModelResultRenderer({
      modelName: 'EchoAlign (research use only)',
      modelVersion: '0.1.2',
      result: echoAlignResultFixtures.severeAs,
    });
    expect(resolved.kind).toBe('echoalign');
    expect(
      resolveModelResultRenderer({
        modelName: 'EchoAlign (research use only)',
        modelVersion: '9.0.0',
        result: echoAlignResultFixtures.severeAs,
      }).kind
    ).toBe('unsupported');
  });
});

describe('EchoAlignResult', () => {
  test('uses the PanEcho layout with the research banner first', () => {
    const { container } = render(
      <EchoAlignResult
        payload={payload}
        modelName="EchoAlign (research use only)"
        modelVersion="0.1.2"
        status="completed"
      />
    );
    const result = container.querySelector('[data-testid="echoalign-result"]')!;
    expect(result.firstElementChild?.getAttribute('data-testid')).toBe('echoalign-research-banner');
    expect(container.textContent).toContain(
      'Research use only — EchoAlign (CC BY-NC 4.0), not for clinical decisions'
    );
    const groups = Array.from(container.querySelectorAll('[data-testid^="echoalign-group-"]')).map(
      element => element.getAttribute('data-testid')
    );
    expect(groups).toEqual([
      'echoalign-group-leftVentricle',
      'echoalign-group-rightHeart',
      'echoalign-group-atria',
      'echoalign-group-valves',
      'echoalign-group-other',
    ]);
    expect(container.querySelector('[data-testid="echoalign-as-screening"]')).not.toBeNull();
    expect(container.textContent).toContain('P(severe AS)');
    expect(container.textContent).toContain('3.1 m/s');
    expect(container.textContent).toContain('LV ejection fraction');
    expect(container.textContent).toContain('66.8 %');
  });

  test('never shows the AS grade or AV Vmax as a diagnosis row', () => {
    const heads = getEchoAlignDisplayRows(payload).map(row => row.head);
    expect(heads).not.toContain('aortic_stenosis_grade');
    expect(heads).not.toContain('aortic_stenosis_classification');
    expect(heads).not.toContain('transaortic_peak_velocity');
    expect(heads).toContain('transaortic_mean_gradient');
    expect(heads).toContain('lavi');
    expect(heads).toContain('mitral_regurgitation_grade');
  });

  test('shows labels shared with PanEcho exactly', () => {
    const labels = getEchoAlignDisplayRows(payload).map(row => row.label);
    for (const label of [
      'LV ejection fraction',
      'LV systolic function',
      'RV systolic pressure',
      'Left atrial size',
      'Aortic valve regurgitation',
      'Mitral valve regurgitation',
      'Tricuspid valve regurgitation',
    ]) {
      expect(labels).toContain(label);
    }
  });
});
