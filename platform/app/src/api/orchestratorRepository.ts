import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import Api from '../pacsAPIAxios';
import { APIResponse, ErrorAPIResponse } from './dto';
import {
  CreateThreadRequest,
  ThreadResponse,
  GetThreadRequest,
  CreateMessageRequest,
  MessageResponse,
  UploadDicomPayloadRequest,
  DicomPayloadResponse,
} from './orchestratorDTO';

const orchestratorRepository = {
  /**
   * Create a new thread
   *
   * @param   {CreateThreadRequest}  request
   *
   * @return  {Promise<APIResponse<ThreadResponse>>}
   */
  async CreateThread(request: CreateThreadRequest = {}): Promise<APIResponse<ThreadResponse>> {
    return Api()
      .post('/v1/orchestrator/threads', request)
      .then((response: AxiosResponse<APIResponse<ThreadResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * Get thread information
   *
   * @param   {GetThreadRequest}  request
   *
   * @return  {Promise<APIResponse<ThreadResponse>>}
   */
  async GetThread(request: GetThreadRequest): Promise<APIResponse<ThreadResponse>> {
    return Api()
      .get(`/v1/orchestrator/threads/${request.threadId}`)
      .then((response: AxiosResponse<APIResponse<ThreadResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * Create a message in a thread
   *
   * @param   {CreateMessageRequest}  request
   *
   * @return  {Promise<APIResponse<MessageResponse>>}
   */
  async CreateMessage(request: CreateMessageRequest): Promise<APIResponse<MessageResponse>> {
    return Api()
      .post(`/v1/orchestrator/threads/${request.threadId}/chat`, {
        message: request.message,
        metadata: request.metadata,
      })
      .then((response: AxiosResponse<APIResponse<MessageResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * Upload DICOM payload to a thread
   *
   * @param   {UploadDicomPayloadRequest}  request
   *
   * @return  {Promise<APIResponse<DicomPayloadResponse>>}
   */
  async UploadDicomPayload(
    request: UploadDicomPayloadRequest
  ): Promise<APIResponse<DicomPayloadResponse>> {
    return Api()
      .post(`/v1/orchestrator/threads/${request.threadId}/dicom`, {
        studyInstanceUID: request.studyInstanceUID,
        seriesInstanceUIDs: request.seriesInstanceUIDs,
        additionalMetadata: request.additionalMetadata,
        containerID: request.containerID,
      })
      .then((response: AxiosResponse<APIResponse<DicomPayloadResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};

export default orchestratorRepository;
