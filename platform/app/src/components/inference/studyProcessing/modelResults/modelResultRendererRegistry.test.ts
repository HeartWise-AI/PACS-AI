import type { ModelExecutionResult } from '../types';
import { cardioSyntaxResultFixtures } from './cardioSyntaxFixtures';
import { cathEfClipResultFixtures } from './cathEfClipFixtures';
import { cathEfResultFixtures } from './cathEfFixtures';
import { deepCoroClipResultFixtures } from './deepCoroClipFixtures';
import { deepCoroMaceResultFixtures } from './deepCoroMaceFixtures';
import { deepRVClipResultFixtures } from './deepRVClipFixtures';
import { deepRVResultFixtures } from './deepRVFixtures';
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

function cathEfResult(
  overrides: Partial<Pick<ModelExecutionResult, 'modelName' | 'modelVersion' | 'result'>> = {}
) {
  return {
    modelName: 'CathEF',
    modelVersion: '1.6.0',
    result: cathEfResultFixtures.withLvefV1,
    ...overrides,
  };
}

function cathEfClipResult(
  overrides: Partial<Pick<ModelExecutionResult, 'modelName' | 'modelVersion' | 'result'>> = {}
) {
  return {
    modelName: 'CathEF-CLIP',
    modelVersion: '1.0.0',
    result: cathEfClipResultFixtures.reducedV1,
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

function deepRVResult(
  overrides: Partial<Pick<ModelExecutionResult, 'modelName' | 'modelVersion' | 'result'>> = {}
) {
  return {
    modelName: 'DeepRV',
    modelVersion: '1.0.0',
    result: deepRVResultFixtures.validV1,
    ...overrides,
  };
}

function deepRVClipResult(
  overrides: Partial<Pick<ModelExecutionResult, 'modelName' | 'modelVersion' | 'result'>> = {}
) {
  return {
    modelName: 'DeepRV-CLIP',
    modelVersion: '1.0.0',
    result: deepRVClipResultFixtures.validV1,
    ...overrides,
  };
}

function deepCoroMaceResult(
  overrides: Partial<Pick<ModelExecutionResult, 'modelName' | 'modelVersion' | 'result'>> = {}
) {
  return {
    modelName: 'DeepCORO_MACE',
    modelVersion: '1.0.0',
    result: deepCoroMaceResultFixtures.validV1,
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

  test.each([
    ['vessel and LVEF output', cathEfResultFixtures.withLvefV1],
    ['vessel-only output', cathEfResultFixtures.vesselOnlyV1],
  ])('selects CathEF for valid %s', (_name, payload) => {
    expect(resolveModelResultRenderer(cathEfResult({ result: payload }))).toEqual({
      kind: 'cathef',
      payload,
    });
  });

  test.each([
    ['different capitalization', { modelName: 'cathef' }],
    ['different model', { modelName: 'CathEF-CLIP' }],
    ['unsupported version', { modelVersion: '2.0.0' }],
    ['missing version', { modelVersion: null }],
  ])('keeps the generic renderer for CathEF with %s', (_name, override) => {
    const executionResult = cathEfResult(override);
    expect(resolveModelResultRenderer(executionResult)).toEqual({
      kind: 'generic',
      payload: executionResult.result,
    });
  });

  test.each([
    ['missing vessels', { ...cathEfResultFixtures.withLvefV1, predictions: {} }],
    [
      'invalid LVEF',
      {
        ...cathEfResultFixtures.withLvefV1,
        predictions: {
          ...cathEfResultFixtures.withLvefV1.predictions,
          LVEF: { presentable: true, values: [{ seriesNumber: 1, value: 101 }] },
        },
      },
    ],
    ['scalar payload', 'future payload'],
  ])('keeps the generic renderer for a CathEF payload with %s', (_name, payload) => {
    expect(resolveModelResultRenderer(cathEfResult({ result: payload }))).toEqual({
      kind: 'generic',
      payload,
    });
  });

  test.each([
    ['reduced output', cathEfClipResultFixtures.reducedV1],
    ['preserved output', cathEfClipResultFixtures.preservedV1],
  ])('selects CathEF-CLIP for valid %s', (_name, payload) => {
    expect(resolveModelResultRenderer(cathEfClipResult({ result: payload }))).toEqual({
      kind: 'cathef-clip',
      payload,
    });
  });

  test.each([
    ['different capitalization', { modelName: 'cathef-clip' }],
    ['different model', { modelName: 'CathEF' }],
    ['unsupported version', { modelVersion: '2.0.0' }],
    ['missing version', { modelVersion: null }],
  ])('keeps the generic renderer for CathEF-CLIP with %s', (_name, override) => {
    const executionResult = cathEfClipResult(override);
    expect(resolveModelResultRenderer(executionResult)).toEqual({
      kind: 'generic',
      payload: executionResult.result,
    });
  });

  test.each([
    [
      'empty no-video result',
      {
        diagnosis: 'No video',
        predictions: {},
        modelRecommendations: { en: 'No video', fr: 'Aucune vidéo', presentable: false },
      },
    ],
    [
      'invalid LVEF',
      {
        ...cathEfClipResultFixtures.reducedV1,
        predictions: {
          ...cathEfClipResultFixtures.reducedV1.predictions,
          LVEF: { value: 101, unit: '%' },
        },
      },
    ],
    ['scalar payload', 'future payload'],
  ])('keeps the generic renderer for a CathEF-CLIP payload with %s', (_name, payload) => {
    expect(resolveModelResultRenderer(cathEfClipResult({ result: payload }))).toEqual({
      kind: 'generic',
      payload,
    });
  });

  test('selects DeepCORO-CLIP for the canonical model identity', () => {
    expect(resolveModelResultRenderer(deepCoroResult())).toEqual({
      kind: 'deepcoro-clip',
      payload: deepCoroClipResultFixtures.validV1,
    });
  });

  test('selects DeepCORO-CLIP for the deployed display identity', () => {
    expect(resolveModelResultRenderer(deepCoroResult({ modelName: 'DeepCORO-CLIP' }))).toEqual({
      kind: 'deepcoro-clip',
      payload: deepCoroClipResultFixtures.validV1,
    });
  });

  test.each([
    ['different capitalization', { modelName: 'deepcoro_clip_generic' }],
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

  test('selects DeepRV only for the exact supported model and version', () => {
    expect(resolveModelResultRenderer(deepRVResult())).toEqual({
      kind: 'deeprv',
      payload: deepRVResultFixtures.validV1,
    });
  });

  test.each([
    ['different capitalization', { modelName: 'deeprv' }],
    ['CLIP model identity', { modelName: 'DeepRV-CLIP' }],
    ['unsupported version', { modelVersion: '2.0.0' }],
    ['missing version', { modelVersion: null }],
  ])('keeps the generic renderer for DeepRV with %s', (_name, override) => {
    const executionResult = deepRVResult(override);

    expect(resolveModelResultRenderer(executionResult)).toEqual({
      kind: 'generic',
      payload: executionResult.result,
    });
  });

  test.each([
    ['empty predictions', { ...deepRVResultFixtures.validV1, predictions: {} }],
    [
      'invalid class',
      {
        ...deepRVResultFixtures.validV1,
        predictions: { ...deepRVResultFixtures.validV1.predictions, class: 2 },
      },
    ],
    ['scalar payload', 'future payload'],
  ])('keeps the generic renderer for a DeepRV payload with %s', (_name, payload) => {
    expect(resolveModelResultRenderer(deepRVResult({ result: payload }))).toEqual({
      kind: 'generic',
      payload,
    });
  });

  test('selects DeepRV-CLIP only for the exact supported model and version', () => {
    expect(resolveModelResultRenderer(deepRVClipResult())).toEqual({
      kind: 'deeprv-clip',
      payload: deepRVClipResultFixtures.validV1,
    });
  });

  test.each([
    ['different capitalization', { modelName: 'deeprv-clip' }],
    ['legacy model identity', { modelName: 'DeepRV' }],
    ['unsupported version', { modelVersion: '2.0.0' }],
    ['missing version', { modelVersion: null }],
  ])('keeps the generic renderer for DeepRV-CLIP with %s', (_name, override) => {
    const executionResult = deepRVClipResult(override);

    expect(resolveModelResultRenderer(executionResult)).toEqual({
      kind: 'generic',
      payload: executionResult.result,
    });
  });

  test.each([
    ['empty predictions', { ...deepRVClipResultFixtures.validV1, predictions: {} }],
    [
      'out-of-range probability',
      {
        ...deepRVClipResultFixtures.validV1,
        predictions: {
          abnormalRV: {
            ...deepRVClipResultFixtures.validV1.predictions.abnormalRV,
            probability: 1.1,
          },
        },
      },
    ],
    ['scalar payload', 'future payload'],
  ])('keeps the generic renderer for a DeepRV-CLIP payload with %s', (_name, payload) => {
    expect(resolveModelResultRenderer(deepRVClipResult({ result: payload }))).toEqual({
      kind: 'generic',
      payload,
    });
  });

  test('selects DeepCORO-MACE for the canonical model identity', () => {
    expect(resolveModelResultRenderer(deepCoroMaceResult())).toEqual({
      kind: 'deepcoro-mace',
      payload: deepCoroMaceResultFixtures.parsedV1,
    });
  });

  test('selects DeepCORO-MACE for the deployed display identity', () => {
    expect(resolveModelResultRenderer(deepCoroMaceResult({ modelName: 'DeepCORO-MACE' }))).toEqual({
      kind: 'deepcoro-mace',
      payload: deepCoroMaceResultFixtures.parsedV1,
    });
  });

  test.each([
    ['different capitalization', { modelName: 'deepcoro_mace' }],
    ['unsupported version', { modelVersion: '2.0.0' }],
    ['missing version', { modelVersion: null }],
  ])('keeps the generic renderer for DeepCORO-MACE with %s', (_name, override) => {
    const executionResult = deepCoroMaceResult(override);
    expect(resolveModelResultRenderer(executionResult)).toEqual({
      kind: 'generic',
      payload: executionResult.result,
    });
  });

  test.each([
    ['empty predictions', { ...deepCoroMaceResultFixtures.validV1, predictions: {} }],
    [
      'missing endpoint',
      {
        ...deepCoroMaceResultFixtures.validV1,
        predictions: {
          ...deepCoroMaceResultFixtures.validV1.predictions,
          primary: {
            ...deepCoroMaceResultFixtures.validV1.predictions.primary,
            compositeMace: undefined,
          },
        },
      },
    ],
    ['scalar payload', 'future payload'],
  ])('keeps the generic renderer for a DeepCORO-MACE payload with %s', (_name, payload) => {
    expect(resolveModelResultRenderer(deepCoroMaceResult({ result: payload }))).toEqual({
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
