import {
  modelExecutionResultFailureFixtures,
  modelExecutionResultFixtures,
} from './executionResultFixtures';

describe('model execution result contracts and fixtures', () => {
  test('cover available, empty, nested, and unknown payload shapes', () => {
    expect(modelExecutionResultFixtures.available.result).toEqual(
      expect.objectContaining({ syntax_score: 24.5 })
    );
    expect(modelExecutionResultFixtures.emptyObject.result).toEqual({});
    expect(modelExecutionResultFixtures.emptyArray.result).toEqual([]);
    expect(modelExecutionResultFixtures.nested.result).toEqual(
      expect.objectContaining({ measurements: expect.any(Array) })
    );
    expect(modelExecutionResultFixtures.unknownShape.result).toBe('future scalar payload');
  });

  test('cover permanent and retryable operator-safe failures', () => {
    expect(Object.keys(modelExecutionResultFailureFixtures)).toEqual(
      expect.arrayContaining([
        'notReady',
        'terminalWithoutResult',
        'malformed',
        'forbidden',
        'notFound',
        'upstreamUnavailable',
      ])
    );
    expect(modelExecutionResultFailureFixtures.upstreamUnavailable.retryable).toBe(true);
    expect(
      Object.values(modelExecutionResultFailureFixtures)
        .filter(fixture => fixture !== modelExecutionResultFailureFixtures.upstreamUnavailable)
        .every(fixture => !fixture.retryable)
    ).toBe(true);
  });

  test('exclude internal correlations and sensitive transport details', () => {
    const serialized = JSON.stringify({
      results: modelExecutionResultFixtures,
      failures: modelExecutionResultFailureFixtures,
    });

    for (const forbidden of [
      'studyServiceJobId',
      'study_service_job_id',
      'candidateId',
      'candidate_id',
      'patientId',
      'patient_id',
      'operatorToken',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
