import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import Api from '../pacsAPIAxios';
import { APIResponse, ErrorAPIResponse } from './dto';
import {
  CreateThreadRequest,
  CreateThreadResponse,
  GetThreadRequest,
  GetThreadResponse,
  CreateMessageRequest,
  MessageResponse,
  UploadDicomPayloadRequestFlat,
  DicomPayloadResponse,
  StudyData,
  SubmitFeedbackRequest,
  FeedbackResponse,
} from './orchestratorDTO';

const orchestratorRepository = {
  /**
   * Create a new thread
   *
   * @param   {CreateThreadRequest}  request
   *
   * @return  {Promise<APIResponse<CreateThreadResponse>>}
   */
  async CreateThread(
    request: CreateThreadRequest = {}
  ): Promise<APIResponse<CreateThreadResponse>> {
    return Api()
      .post('/v1/orchestrator/threads', request)
      .then((response: AxiosResponse<APIResponse<CreateThreadResponse>>) => {
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
   * @return  {Promise<APIResponse<GetThreadResponse>>}
   */
  async GetThread(request: GetThreadRequest): Promise<APIResponse<GetThreadResponse>> {
    return Api()
      .get(`/v1/orchestrator/threads/${request.threadId}`)
      .then((response: AxiosResponse<APIResponse<GetThreadResponse>>) => {
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
   * @param   {UploadDicomPayloadRequestFlat}  request
   *
   * @return  {Promise<APIResponse<DicomPayloadResponse>>}
   */
  async UploadDicomPayload(
    request: UploadDicomPayloadRequestFlat
  ): Promise<APIResponse<DicomPayloadResponse>> {
    // Extract modality and previewImageBase64 from additionalMetadata if provided
    const modality = request.additionalMetadata?.modality || null;
    const previewImageBase64 = request.additionalMetadata?.previewImageBase64 || null;

    // Create a clean additionalMetadata object without the extracted fields
    const cleanAdditionalMetadata = { ...request.additionalMetadata };
    delete cleanAdditionalMetadata?.modality;
    delete cleanAdditionalMetadata?.previewImageBase64;

    // Transform the flat request into the payload structure expected by the Python API
    const studyData: StudyData = {
      studyInstanceUID: request.studyInstanceUID,
      seriesInstanceUIDs: request.seriesInstanceUIDs,
      additionalMetadata: cleanAdditionalMetadata,
      modality: modality,
      previewImageBase64: previewImageBase64,
    };

    const payload = {
      payload: [studyData],
    };

    return Api()
      .post(`/v1/orchestrator/threads/${request.threadId}/dicom`, payload)
      .then((response: AxiosResponse<APIResponse<DicomPayloadResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * Submit feedback for a message (thumbs up/down)
   *
   * @param   {SubmitFeedbackRequest}  request
   *
   * @return  {Promise<APIResponse<FeedbackResponse>>}
   */
  async SubmitFeedback(
    request: SubmitFeedbackRequest
  ): Promise<APIResponse<FeedbackResponse>> {
    return Api()
      .post(`/v1/orchestrator/threads/${request.threadId}/messages/${request.messageId}/feedback`, {
        feedback: request.feedback,
      })
      .then((response: AxiosResponse<APIResponse<FeedbackResponse>>) => {
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
