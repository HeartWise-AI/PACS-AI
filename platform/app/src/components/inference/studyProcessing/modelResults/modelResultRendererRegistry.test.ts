import type { ModelExecutionResult } from '../types';
import { cardioSyntaxResultFixtures } from './cardioSyntaxFixtures';
import { deepCoroClipResultFixtures } from './deepCoroClipFixtures';
import { parseEchoPrimeResultPayload } from './echoPrimeContract';
import { echoPrimeResultFixtures } from './echoPrimeFixtures';
import { parsePanEchoResultPayload } from './panEchoContract';
import { panEchoResultFixtures } from './panEchoFixtures';
import { resolveModelResultRenderer } from './modelResultRendererRegistry';

function result(
  overrides: Partial<Pick<ModelExecutionResult, 'modelName' | 'modelVersion' | 'result'>> = {}
) {
  return {
    modelName: 'CardioSyntax',
    modelVersion: '1.0.0',
    result: cardioSyntaxResultFixtures.validV1,
    ...overrides,
  };
}

function deepCoroResult(
  overrides: Partial<Pick<ModelExecutionResult, 'modelName' | 'modelVersion' | 'result'>> = {}
) {
  return {
    modelName: 'DeepCoro_CLIP_generic',
    modelVersion: '1.0.0',
    result: deepCoroClipResultFixtures.validV1,
    ...overrides,
  };
}

describe('model result renderer registry', () => {
  test('selects CardioSyntax only for the exact supported model and version', () => {
    expect(resolveModelResultRenderer(result())).toEqual({
      kind: 'cardiosyntax',
      payload: cardioSyntaxResultFixtures.validV1,
    });
  });

  test.each([
    ['different capitalization', { modelName: 'cardiosyntax' }],
    ['different model', { modelName: 'FutureModel' }],
    ['unsupported version', { modelVersion: '2.0.0' }],
    ['missing version', { modelVersion: null }],
  ])('keeps the generic renderer for %s', (_name, override) => {
    const executionResult = result(override);

    expect(resolveModelResultRenderer(executionResult)).toEqual({
      kind: 'generic',
      payload: executionResult.result,
    });
  });

  test.each([
    ['empty predictions', { ...cardioSyntaxResultFixtures.validV1, predictions: {} }],
    [
      'invalid score',
      {
        ...cardioSyntaxResultFixtures.validV1,
        predictions: {
          ...cardioSyntaxResultFixtures.validV1.predictions,
          'Global Cardiac Syntax': { regression: 'not-a-number', category: 'moderate' },
        },
      },
    ],
    ['scalar payload', 'future payload'],
  ])('keeps the generic renderer for a CardioSyntax payload with %s', (_name, payload) => {
    expect(resolveModelResultRenderer(result({ result: payload }))).toEqual({
      kind: 'generic',
      payload,
    });
  });

  test('selects DeepCORO-CLIP only for the exact supported model and version', () => {
    expect(resolveModelResultRenderer(deepCoroResult())).toEqual({
      kind: 'deepcoro-clip',
      payload: deepCoroClipResultFixtures.validV1,
    });
  });

  test.each([
    ['different capitalization', { modelName: 'deepcoro_clip_generic' }],
    ['display name instead of canonical identity', { modelName: 'DeepCORO-CLIP' }],
    ['unsupported version', { modelVersion: '2.0.0' }],
    ['missing version', { modelVersion: null }],
  ])('keeps the generic renderer for DeepCORO-CLIP with %s', (_name, override) => {
    const executionResult = deepCoroResult(override);

    expect(resolveModelResultRenderer(executionResult)).toEqual({
      kind: 'generic',
      payload: executionResult.result,
    });
  });

  test.each([
    ['empty predictions', { ...deepCoroClipResultFixtures.validV1, predictions: {} }],
    [
      'missing artery',
      {
        ...deepCoroClipResultFixtures.validV1,
        predictions: {
          ...deepCoroClipResultFixtures.validV1.predictions,
          'Proximal RCA': undefined,
        },
      },
    ],
    [
      'out-of-range probability',
      {
        ...deepCoroClipResultFixtures.validV1,
        predictions: {
          ...deepCoroClipResultFixtures.validV1.predictions,
          'Proximal RCA': {
            ...deepCoroClipResultFixtures.validV1.predictions['Proximal RCA'],
            cto_prob: 1.1,
          },
        },
      },
    ],
    ['scalar payload', 'future payload'],
  ])('keeps the generic renderer for a DeepCORO-CLIP payload with %s', (_name, payload) => {
    expect(resolveModelResultRenderer(deepCoroResult({ result: payload }))).toEqual({
      kind: 'generic',
      payload,
    });
  });

  test('does not modify the unknown payload used by the generic renderer', () => {
    const payload = { future: { nested: ['value'] } };

    const resolved = resolveModelResultRenderer(
      result({ modelName: 'FutureModel', result: payload })
    );

    expect(resolved).toEqual({ kind: 'generic', payload });
    expect(resolved.payload).toBe(payload);
  });

  test.each([
    ['1.0.0', panEchoResultFixtures.successfulV1],
    ['1.4.0', panEchoResultFixtures.partialV1],
  ])('selects PanEcho for supported version %s', (modelVersion, payload) => {
    expect(
      resolveModelResultRenderer({ modelName: 'PanEcho', modelVersion, result: payload })
    ).toEqual({
      kind: 'panecho',
      payload: parsePanEchoResultPayload(payload),
    });
  });

  test('selects EchoPrime for its supported identity and version', () => {
    expect(
      resolveModelResultRenderer({
        modelName: 'EchoPrime',
        modelVersion: '1.2.0',
        result: echoPrimeResultFixtures.successfulV1,
      })
    ).toEqual({
      kind: 'echoprime',
      payload: parseEchoPrimeResultPayload(echoPrimeResultFixtures.successfulV1),
    });
  });

  test.each([
    ['PanEcho', '9.0.0', panEchoResultFixtures.successfulV1],
    ['EchoPrime', null, echoPrimeResultFixtures.successfulV1],
  ])('provides an unsupported-version fallback for %s %s', (modelName, modelVersion, payload) => {
    expect(resolveModelResultRenderer({ modelName, modelVersion, result: payload })).toEqual({
      kind: 'unsupported',
      modelName,
      modelVersion,
      payload,
      reason: 'version',
    });
  });

  test.each([
    ['PanEcho', '1.0.0'],
    ['EchoPrime', '1.2.0'],
  ])('provides a raw fallback for a malformed %s payload', (modelName, modelVersion) => {
    const payload = 'unsupported scalar payload';
    expect(resolveModelResultRenderer({ modelName, modelVersion, result: payload })).toEqual({
      kind: 'unsupported',
      modelName,
      modelVersion,
      payload,
      reason: 'payload',
    });
  });
});
