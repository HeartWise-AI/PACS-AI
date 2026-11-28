import React from 'react';
import { render } from '@testing-library/react';
import { EchoAlignResult } from './EchoAlignResult';
import { isSupportedEchoAlignVersion, parseEchoAlignResultPayload } from './echoAlignContract';
import { echoAlignResultFixtures } from './echoAlignFixtures';
import { resolveModelResultRenderer } from './modelResultRendererRegistry';
import { parseEchoSrResultPayload } from './echoSrContract';
import { echoSrResultFixtures } from './echoSrFixtures';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
    i18n: { language: 'en-US' },
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

  test('parses heads and keeps the raw result', () => {
    expect(payload.clipsUsed).toBe(55);
    expect(payload.raw).toBe(echoAlignResultFixtures.severeAs);
    expect(parseEchoAlignResultPayload({ predictions: {} })).toBeNull();
    expect(parseEchoAlignResultPayload(null)).toBeNull();
  });

  test('is resolved to the EchoAlign template, and unsupported versions are not shown as generic', () => {
    expect(
      resolveModelResultRenderer({
        modelName: 'EchoAlign (research use only)',
        modelVersion: '0.1.2',
        result: echoAlignResultFixtures.severeAs,
      }).kind
    ).toBe('echoalign');
    expect(
      resolveModelResultRenderer({
        modelName: 'EchoAlign (research use only)',
        modelVersion: '9.0.0',
        result: echoAlignResultFixtures.severeAs,
      }).kind
    ).toBe('unsupported');
  });
});

describe('EchoAlignResult structured report', () => {
  test('research banner first, sections by structure, AV screening inside the aortic valve subsection', () => {
    const measured = parseEchoSrResultPayload(echoSrResultFixtures.severeGe)!;
    const { container } = render(
      <EchoAlignResult
        payload={payload}
        measured={measured}
        modelName="EchoAlign (research use only)"
        modelVersion="0.1.6"
        status="completed"
      />
    );
    const result = container.querySelector('[data-testid="echoalign-result"]')!;
    expect(result.firstElementChild?.getAttribute('data-testid')).toBe('echoalign-research-banner');
    expect(container.querySelector('[data-testid="echoalign-as-screening"]')).toBeNull();
    const av = container.querySelector('[data-testid="echo-report-section-av"]')!;
    expect(av.querySelector('[data-testid="echo-report-as-grade"]')).not.toBeNull();
    expect(av.querySelector('[data-testid="echo-report-as-screening"]')?.textContent).toContain('P(severe AS)');
    expect(av.querySelector('[data-testid="echo-report-as-moderate-or-severe"]')).not.toBeNull();
    expect(container.textContent).toContain('LV ejection fraction');
    expect(container.textContent).toContain('66.8 %');
    // AS grade, classifier and Vmax are not shown as plain rows.
    const aiKeys = Array.from(container.querySelectorAll('[data-testid="echo-report-ai-row"]')).map(
      element => element.querySelector('dt')?.textContent
    );
    expect(aiKeys).not.toContain('aortic_stenosis_grade');
    expect(container.querySelector('[data-testid="echo-report-conclusion"]')).not.toBeNull();
  });

  test('binary findings show flagged / not flagged with the AI probability and threshold', () => {
    const { container } = render(
      <EchoAlignResult payload={payload} modelName="EchoAlign (research use only)" modelVersion="0.1.6" status="completed" />
    );
    const rv = Array.from(container.querySelectorAll('[data-testid="echo-report-ai-row"]')).find(
      element => element.querySelector('dt')?.textContent === 'RV systolic function'
    )!;
    expect(rv.textContent).toMatch(/Not flagged|Flagged/);
    expect(rv.textContent).toMatch(/\d+ %|<1 %/);
    expect(rv.textContent).toContain('threshold');
  });
});

describe('EchoAlign skipped studies', () => {
  test('say why the model did not run, with the banner and no findings', () => {
    const skipped = parseEchoAlignResultPayload({
      diagnosis: '[Research use only] Not run: transesophageal echo (TEE) is not supported',
      predictions: {
        skipReason: 'TEE_NOT_SUPPORTED',
        skipMessage: 'Not run: TEE',
        clipsUsed: 0,
        allHeads: {},
        summary: {},
        keyHeads: {},
      },
    })!;
    expect(skipped.skipReason).toBe('TEE_NOT_SUPPORTED');
    const { container } = render(
      <EchoAlignResult payload={skipped} modelName="EchoAlign (research use only)" modelVersion="0.1.5" status="completed" />
    );
    expect(container.querySelector('[data-testid="echoalign-research-banner"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="echoalign-skip-reason"]')?.textContent).toContain('transesophageal');
    expect(container.querySelector('[data-testid="echoalign-partial-empty"]')).toBeNull();
    expect(container.querySelector('[data-testid="echo-structured-report"]')).toBeNull();
  });
});
