import orthancRepository from '../../../api/orthancRepository';
import { Error as APIErrorCode } from '../../../api/dto';
import type { StudyRefreshRepository } from './useStudyRefresh';

/**
 * The api-pacs calls that retrieve a study from its PACS source, as the work
 * list makes them: POST /v1/orthanc/modality/retrieve, then the job status
 * from /v1/orthanc/jobs. Shared by the viewer's "Refresh study from PACS"
 * and the AI Predictions page.
 */
export function createStudyRefreshRepository(api = orthancRepository): StudyRefreshRepository {
  return {
    loadModalities: async () => {
      const response = await api.GetDICOMModalities();
      return response.data?.modalities ?? null;
    },
    retrieveStudy: async request => {
      try {
        const response = await api.RetrieveModalityStudy(request);
        return (response.data ?? []).map(job => job.id).filter(Boolean);
      } catch (error: unknown) {
        // The server answers "duplicate" when the local copy already has
        // every series of the PACS: there is nothing to wait for.
        if ((error as { errorCode?: string } | null)?.errorCode === APIErrorCode.DUPLICATE_RECORD) {
          return [];
        }
        throw error;
      }
    },
    loadJobs: async jobIds => {
      const response = await api.GetJobsInfo({ jobIds });
      const jobs = response.data as unknown;
      return Array.isArray(jobs) ? jobs : [];
    },
  };
}
