import type {
  GetInferenceIngestionJobsResponse,
  UpdateInferenceIngestionJobRequest,
} from '@pacs-ai/extension-core/src/api/inferenceDTO';
import type { UserResponse } from '@pacs-ai/extension-core/src/api/userDTO';
import { getIngestionJobTimingMinutes } from './ingestionJobTiming';

/** A job notifies unless the gateway says it does not (older gateways: on). */
export function isIngestionJobNotificationsEnabled(
  job: Pick<GetInferenceIngestionJobsResponse, 'notificationsEnabled'>
): boolean {
  return job.notificationsEnabled !== false;
}

/**
 * The update request that flips only the notification switch: every other
 * setting is sent back exactly as the job has it. Null when the job's timing
 * is unknown and an update could not preserve it.
 */
export function buildIngestionJobNotificationsUpdate(
  job: GetInferenceIngestionJobsResponse,
  notificationsEnabled: boolean
): UpdateInferenceIngestionJobRequest | null {
  const intervalInMinutes = getIngestionJobTimingMinutes(job);
  if (intervalInMinutes === undefined) {
    return null;
  }
  const request: UpdateInferenceIngestionJobRequest = {
    id: job.id,
    modalities: job.modalities,
    intervalInMinutes,
    scheduleStartTimestamp: job.scheduleStartTimestamp,
    scheduleEndTimestamp: job.scheduleEndTimestamp,
    notificationsEnabled,
  };
  if (typeof job.recentWindowMinutes === 'number') {
    request.recentWindowMinutes = job.recentWindowMinutes;
  }
  if (typeof job.missingPollsThreshold === 'number') {
    request.missingPollsThreshold = job.missingPollsThreshold;
  }
  if (job.studyTimeStart) {
    request.studyTimeStart = job.studyTimeStart;
  }
  if (job.studyTimeEnd) {
    request.studyTimeEnd = job.studyTimeEnd;
  }
  return request;
}

export const UNKNOWN_JOB_CREATOR = '—';

/** Name (or e-mail) of the job's creator, or a dash when it is not known. */
export function formatIngestionJobCreator(
  job: Pick<GetInferenceIngestionJobsResponse, 'createdByUserId'>,
  usersById: ReadonlyMap<string, Pick<UserResponse, 'name' | 'email'>>
): string {
  const userId = job.createdByUserId?.trim();
  if (!userId) {
    return UNKNOWN_JOB_CREATOR;
  }
  const user = usersById.get(userId);
  return user?.name?.trim() || user?.email?.trim() || UNKNOWN_JOB_CREATOR;
}
