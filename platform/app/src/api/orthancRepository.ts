import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import {
  GetModalityStudiesRequest,
  GetModalityStudiesResponse,
  GetJobInfoRequest,
  GetJobInfoResponse,
  GetLocalResourceRequest,
  GetLocalResourceResponse,
  RetrieveModalityStudyRequest,
  RetrieveModalityStudyResponse,
} from './orthancDTO';

const orthancRepository = {
  /**
   * Get local resource
   *
   * @return  {GetLocalResourceResponse}
   */
  async GetLocalResource(
    request: GetLocalResourceRequest
  ): Promise<APIResponse<GetLocalResourceResponse>> {
    return Api()
      .post(`/v1/orthanc/find/local-resources`, request)
      .then((response: AxiosResponse<APIResponse<GetLocalResourceResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get modality studies
   *
   * @return  {GetModalityStudiesResponse}
   */
  async GetModalityStudies(
    request: GetModalityStudiesRequest
  ): Promise<APIResponse<GetModalityStudiesResponse>> {
    return Api()
      .post(`/v1/orthanc/modality/studies`, request)
      .then((response: AxiosResponse<APIResponse<GetModalityStudiesResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get job info
   *
   * @return  {GetJobInfoResponse}
   */
  async GetJobInfo(request: GetJobInfoRequest): Promise<APIResponse<GetJobInfoResponse>> {
    return Api()
      .get(`/v1/orthanc/jobs`, {
        params: { jobIDs: request.jobIDs },
        paramsSerializer: params => {
          return params.jobIDs.map(id => `jobIDs=${id}`).join('&');
        },
      })
      .then((response: AxiosResponse<APIResponse<GetJobInfoResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Retrieve modality study
   *
   * @return  {RetrieveModalityStudyResponse[]}
   */
  async RetrieveModalityStudy(
    request: RetrieveModalityStudyRequest
  ): Promise<APIResponse<RetrieveModalityStudyResponse[]>> {
    return Api()
      .post(`/v1/orthanc/modality/retrieve`, {
        aet: request.aet,
        studyInstanceUID: request.studyInstanceUID,
      })
      .then((response: AxiosResponse<APIResponse<RetrieveModalityStudyResponse[]>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};

export default orthancRepository;
