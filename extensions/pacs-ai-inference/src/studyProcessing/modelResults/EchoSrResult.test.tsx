import React from 'react';
import { render } from '@testing-library/react';
import { EchoSrResult } from './EchoSrResult';
import { parseEchoSrResultPayload } from './echoSrContract';
import { echoSrResultFixtures } from './echoSrFixtures';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? ''),
  }),
}));

function renderFixture(name: keyof typeof echoSrResultFixtures) {
  const payload = parseEchoSrResultPayload(echoSrResultFixtures[name])!;
  return render(
    <EchoSrResult
      payload={payload}
      modelVersion="1.0.0"
    />
  ).container;
}

describe('EchoSrResult', () => {
  test('shows the measured severe grading, key values with methods and the full list', () => {
    const container = renderFixture('severeGe');
    const grading = container.querySelector('[data-testid="echo-sr-grading"]')!;

    expect(container.textContent).toContain('Echo measurements (SR)');
    expect(grading.getAttribute('data-grade')).toBe('severe');
    expect(grading.textContent).toContain('Severe AS (measured)');
    expect(grading.textContent).toContain('Derived from the measured Doppler values');
    expect(container.querySelector('[data-testid="echo-sr-ava-note"]')?.textContent).toBe(
      'AVA 0.71 cm² < 1.0 cm²'
    );
    expect(
      container.querySelector('[data-testid="echo-sr-summary-avVmax"]')?.textContent
    ).toContain('4.31 m/s');
    expect(
      container.querySelector('[data-testid="echo-sr-summary-avVmax"]')?.textContent
    ).toContain('Measured');
    expect(container.querySelector('[data-testid="echo-sr-summary-ava"]')?.textContent).toContain(
      '0.71 cm² (Continuity Equation by Velocity Time Integral)'
    );
    expect(container.querySelector('[data-testid="echo-sr-summary-lvef"]')?.textContent).toContain(
      '55 % (Method of Disks, Biplane)'
    );
    expect(container.textContent).toContain('Teichholz 62 %');
    expect(
      container.querySelector('[data-testid="echo-sr-all-measurements"]')?.textContent
    ).toContain('All measurements (3)');
    expect(container.textContent).toContain('GE Vingmed Ultrasound Vivid E95');
    expect(container.textContent).toContain('Peak velocities and gradients: maximum');
  });

  test('shows a normal study as no AS by Doppler', () => {
    const container = renderFixture('normal');

    expect(
      container.querySelector('[data-testid="echo-sr-grading"]')?.getAttribute('data-grade')
    ).toBe('none');
    expect(container.textContent).toContain('No AS by Doppler (measured)');
    expect(
      container.querySelector('[data-testid="echo-sr-summary-avVmax"]')?.textContent
    ).toContain('1.29 m/s');
    expect(container.querySelector('[data-testid="echo-sr-all-measurements"]')).toBeNull();
  });

  test('says when the grading is discordant', () => {
    const container = renderFixture('discordant');

    expect(container.textContent).toContain('Moderate AS, AVA < 1.0 cm2 (measured, discordant)');
    expect(container.querySelector('[data-testid="echo-sr-ava-note"]')?.textContent).toContain(
      'consider low-flow, low-gradient AS'
    );
    expect(container.textContent).toContain('2 DICOM SR');
  });

  test('says when the SR has no aortic Doppler', () => {
    const payload = parseEchoSrResultPayload({
      schema: 'echo-sr-measurements/1',
      summary: {},
      source: { srCount: 1 },
    })!;
    const { container } = render(<EchoSrResult payload={payload} />);

    expect(container.querySelector('[data-testid="echo-sr-no-grading"]')).not.toBeNull();
  });
});
