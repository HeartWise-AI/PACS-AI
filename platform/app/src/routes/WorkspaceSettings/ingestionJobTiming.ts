import type { GetInferenceIngestionJobsResponse } from '../../api/inferenceDTO';

// New backends return stabilityMinutes; older backends use intervalInMinutes.
export function getIngestionJobTimingMinutes(
  job: Pick<GetInferenceIngestionJobsResponse, 'stabilityMinutes' | 'intervalInMinutes'>
): number | undefined {
  const minutes = job.stabilityMinutes ?? job.intervalInMinutes;
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0
    ? minutes
    : undefined;
}
