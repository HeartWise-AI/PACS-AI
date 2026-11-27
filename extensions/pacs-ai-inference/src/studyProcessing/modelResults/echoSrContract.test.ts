import {
  echoSrGradingLabel,
  formatEchoSrValue,
  isSupportedEchoSrVersion,
  parseEchoSrResultPayload,
} from './echoSrContract';
import { echoSrResultFixtures } from './echoSrFixtures';
import { resolveModelResultRenderer } from './modelResultRendererRegistry';

describe('echo-sr-measurements contract', () => {
  test('parses the severe GE fixture', () => {
    const payload = parseEchoSrResultPayload(echoSrResultFixtures.severeGe)!;

    expect(payload.summary.avVmax).toEqual({
      value: 4.31,
      unit: 'm/s',
      mode: 'Doppler Continuous Wave',
      site: 'Aortic Valve',
      rule: 'chosen, max',
    });
    expect(payload.summary.lvef?.otherMethods).toEqual([{ method: 'Teichholz', value: 62 }]);
    expect(payload.asGrading?.grade).toBe('severe');
    expect(payload.asGrading?.discordant).toBe(false);
    expect(payload.measurements).toHaveLength(3);
    expect(payload.source.documents[0].model).toBe('Vivid E95');
  });

  test('keeps the discordant flag and tolerates missing parts', () => {
    expect(parseEchoSrResultPayload(echoSrResultFixtures.discordant)!.asGrading?.discordant).toBe(
      true
    );
    const minimal = parseEchoSrResultPayload({
      schema: 'echo-sr-measurements/1',
      summary: { avVmax: { value: 'x' } },
    })!;
    expect(minimal.summary).toEqual({});
    expect(minimal.asGrading).toBeNull();
    expect(minimal.measurements).toEqual([]);
  });

  test('rejects other payloads', () => {
    expect(parseEchoSrResultPayload({ predictions: {} })).toBeNull();
    expect(parseEchoSrResultPayload(null)).toBeNull();
  });

  test('matches 1.0.x versions only', () => {
    expect(isSupportedEchoSrVersion('1.0.0')).toBe(true);
    expect(isSupportedEchoSrVersion('1.0.7')).toBe(true);
    expect(isSupportedEchoSrVersion('2.0.0')).toBe(false);
    expect(isSupportedEchoSrVersion(null)).toBe(false);
  });

  test('formats values and picks the French label', () => {
    expect(formatEchoSrValue({ value: 0.7, unit: 'cm2' })).toBe('0.7 cm²');
    expect(formatEchoSrValue({ value: 60, unit: '%' }, 0)).toBe('60 %');
    expect(formatEchoSrValue(undefined)).toBe('—');
    const grading = parseEchoSrResultPayload(echoSrResultFixtures.severeGe)!.asGrading!;
    expect(echoSrGradingLabel(grading, 'fr')).toBe('Sténose aortique sévère (mesurée)');
    expect(echoSrGradingLabel(grading, 'en-US')).toBe('Severe AS (measured)');
  });

  test('resolves the echo-sr renderer', () => {
    const resolved = resolveModelResultRenderer({
      modelName: 'echo-sr-measurements',
      modelVersion: '1.0.0',
      result: echoSrResultFixtures.normal,
    });
    expect(resolved.kind).toBe('echo-sr');
  });
});
