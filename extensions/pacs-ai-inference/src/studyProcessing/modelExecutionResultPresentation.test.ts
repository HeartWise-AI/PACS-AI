import { modelExecutionResultFailureFixtures } from './executionResultFixtures';
import {
  getModelExecutionResultFailurePresentation,
  isEmptyModelExecutionResult,
} from './modelExecutionResultPresentation';

describe('model execution result presentation', () => {
  test.each([
    [modelExecutionResultFailureFixtures.forbidden, 'permission'],
    [modelExecutionResultFailureFixtures.notFound, 'unavailable'],
    [modelExecutionResultFailureFixtures.notReady, 'viewable completed result'],
    [modelExecutionResultFailureFixtures.terminalWithoutResult, 'missing'],
    [modelExecutionResultFailureFixtures.upstreamUnavailable, 'temporarily unavailable'],
  ])('maps a normalized failure to stable operator-safe copy', (failure, expectedText) => {
    const presentation = getModelExecutionResultFailurePresentation(failure);

    expect(presentation.defaultValue).toContain(expectedText);
    expect(JSON.stringify(presentation)).not.toMatch(
      /patient|credential|upstream body|job[_ -]?id/i
    );
  });

  test('uses generic safe copy when no normalized failure is available', () => {
    expect(getModelExecutionResultFailurePresentation(null)).toEqual({
      key: 'ProcessingModelResultUnknownError',
      defaultValue: 'The model result could not be displayed.',
    });
  });

  test.each([
    [{}, true],
    [[], true],
    [{ value: null }, false],
    [[null], false],
    ['', false],
    [null, false],
  ])('detects intentional empty structured results', (value, expected) => {
    expect(isEmptyModelExecutionResult(value)).toBe(expected);
  });
});
