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
  GetDICOMModalitiesResponse,
  TriggerDICOMEchoSCURequest,
  UpdateDICOMModalityRequest,
  RemoveDICOMModalityRequest,
  StoreStudyCustomSeriesRequest,
  GetLnkedDICOMModalityWithEnabledCStoreRequest,
  GetLnkedDICOMModalityWithEnabledCStoreResponse,
} from './orthancDTO';

const orthancRepository = {
  /**
   * Get local SOP instance
   *
   * @return  {GetLocalResourceResponse}
   */
  async GetLocalSOPInstance(
    request: GetLocalResourceRequest
  ): Promise<APIResponse<GetLocalResourceResponse>> {
    return Api()
      .get(`/v1/orthanc/sop-instance/${request.sopInstanceUID}/find`)
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
   * Get jobs info
   *
   * @return  {GetJobInfoResponse}
   */
  async GetJobsInfo(request: GetJobInfoRequest): Promise<APIResponse<GetJobInfoResponse>> {
    return Api()
      .get(`/v1/orthanc/jobs`, {
        params: { jobIds: request.jobIds },
        paramsSerializer: {
          serialize: params => params.jobIds.map(id => `jobIds=${id}`).join('&'),
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
   * Get DICOM modalities
   *
   * @return  {Promise<APIResponse><GetDICOMModalitiesResponse>}
   */
  async GetDICOMModalities(): Promise<APIResponse<GetDICOMModalitiesResponse>> {
    return Api()
      .get(`/v1/orthanc/modalities/list`)
      .then((response: AxiosResponse<APIResponse<GetDICOMModalitiesResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get linked DICOM modality with enabled C-Store
   *
   * @return  {GetLnkedDICOMModalityWithEnabledCStoreResponse}
   */
  async GetLnkedDICOMModalityWithEnabledCStore(
    request: GetLnkedDICOMModalityWithEnabledCStoreRequest
  ): Promise<APIResponse<GetLnkedDICOMModalityWithEnabledCStoreResponse>> {
    return Api()
      .get(`/v1/orthanc/modality/${request.modalityId}/linked/storage/enabled`)
      .then(
        (response: AxiosResponse<APIResponse<GetLnkedDICOMModalityWithEnabledCStoreResponse>>) => {
          const { data } = response;
          return data;
        }
      )
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
        modalityId: request.modalityId,
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
  /**
   * Remove DICOM modality
   *
   * @return  {void}
   */
  async RemoveDICOMModality(request: RemoveDICOMModalityRequest): Promise<APIResponse<void>> {
    return Api()
      .delete(`/v1/orthanc/modality/${request.modalityId}/remove`)
      .then((response: AxiosResponse<APIResponse<void>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Store study custom series
   *
   * @return  {void}
   */
  async StoreStudyCustomSeries(request: StoreStudyCustomSeriesRequest): Promise<APIResponse<void>> {
    const formData = new FormData();

    formData.append('file', request.file, 'file.pdf');
    formData.append('seriesInstanceUIDs', request.seriesInstanceUIDs);
    formData.append('patientID', request.patientID);
    formData.append('patientName', request.patientName);
    formData.append('modelName', request.modelName);
    formData.append('modelVersion', request.modelVersion);

    return Api()
      .post(
        `/v1/orthanc/modality/${request.modalityID}/study/${request.studyInstanceUID}/series/store`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      .then((response: AxiosResponse<APIResponse<void>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Trigger DICOM Echo SCU
   *
   * @return  {void}
   */
  async TriggerDICOMEchoSCU(request: TriggerDICOMEchoSCURequest): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/orthanc/modality/${request.modalityId}/echo`)
      .then((response: AxiosResponse<APIResponse<void>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Update DICOM modality
   *
   * @return  {void}
   */
  async UpdateDICOMModality(request: UpdateDICOMModalityRequest): Promise<APIResponse<void>> {
    return Api()
      .put(`/v1/orthanc/modality/${request.modalityId}/update`, {
        aet: request.aet,
        host: request.host,
        port: request.port,
        cFindEnabled: request.cFindEnabled,
        cMoveEnabled: request.cMoveEnabled,
        cStoreEnabled: request.cStoreEnabled,
      })
      .then((response: AxiosResponse<APIResponse<void>>) => {
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
