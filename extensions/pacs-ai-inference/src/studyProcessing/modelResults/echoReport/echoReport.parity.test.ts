// Parity of the TypeScript port with pacs-ai-backend model-examples/PanEcho/utils/echo_report.py.
// __fixtures__/parityCases.json holds synthetic inputs (no identifiers) and the Python output of
// build_report() for each; regenerate it with the Python module when the thresholds change.
import cases from './__fixtures__/parityCases.json';
import thresholds from './echo_report_thresholds.json';
import { buildReport } from './echoReport';

// JSON round trip drops undefined fields, as the Python output has no undefined.
function normalise(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item) => (item === undefined ? null : item)));
}

function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== null) out[key] = stripNulls(item);
    }
    return out;
  }
  return value;
}

describe('echo report parity with the Python engine', () => {
  it('uses the same thresholds version as the fixtures', () => {
    for (const testCase of cases as { expected: { thresholdsVersion: string } }[]) {
      expect(testCase.expected.thresholdsVersion).toBe(thresholds.version);
    }
  });

  it.each((cases as { name: string }[]).map(c => [c.name, c]))('%s', (_name, testCase) => {
    const c = testCase as unknown as {
      model: string | null;
      result: unknown;
      measured: unknown;
      sex: string | null;
      expected: unknown;
    };
    const actual = buildReport(c.model, c.result, c.measured, c.sex);
    expect(stripNulls(normalise(actual))).toEqual(stripNulls(normalise(c.expected)));
  });
});
