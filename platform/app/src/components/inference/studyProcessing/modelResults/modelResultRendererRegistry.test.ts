import type { ModelExecutionResult } from '../types';
import { cardioSyntaxResultFixtures } from './cardioSyntaxFixtures';
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

  test('does not modify the unknown payload used by the generic renderer', () => {
    const payload = { future: { nested: ['value'] } };

    const resolved = resolveModelResultRenderer(
      result({ modelName: 'FutureModel', result: payload })
    );

    expect(resolved).toEqual({ kind: 'generic', payload });
    expect(resolved.payload).toBe(payload);
  });
});
