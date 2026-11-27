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
  SubmitChatFeedbackRequest,
  ChatFeedbackSaved,
  RemoveChatFeedbackRequest,
  ListChatFeedbackRequest,
  ListChatFeedbackResponse,
  ChatFeedbackCountsResponse,
  ChatFeedbackDetail,
  GetChatProgressRequest,
  ChatProgressResponse,
  ChatProgressError,
  ListChatThreadsRequest,
  ListChatThreadsResponse,
  ChatThreadHistory,
  ChatSettingsResponse,
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
        // Keep the HTTP status (absent for a network error): the chat box
        // decides from it whether to retry. A proxy error page (HTML) has no
        // JSON body to spread.
        const { response } = error;
        const body = response?.data;
        const json = body && typeof body === 'object' ? body : {};
        throw {
          ...json,
          message: (json as ErrorAPIResponse).message || error.message,
          status: response?.status,
        };
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
   * Steps so far of the chat request in flight for a thread. Polled while
   * CreateMessage is pending. Rejects with a ChatProgressError carrying the
   * HTTP status, so callers can tell an older backend (404) from an outage.
   *
   * @param   {GetChatProgressRequest}  request
   *
   * @return  {Promise<APIResponse<ChatProgressResponse>>}
   */
  async GetChatProgress(
    request: GetChatProgressRequest
  ): Promise<APIResponse<ChatProgressResponse>> {
    return Api()
      .get(`/v1/orchestrator/threads/${encodeURIComponent(request.threadId)}/chat/progress`)
      .then((response: AxiosResponse<APIResponse<ChatProgressResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const body: any = error.response?.data;
        const failure: ChatProgressError = {
          status: error.response?.status,
          errorCode: body && typeof body === 'object' ? body.errorCode : undefined,
          message: body && typeof body === 'object' ? body.message : undefined,
        };
        throw failure;
      });
  },

  /**
   * The signed-in user's earlier chat threads about one study, latest first.
   */
  async ListChatThreads(
    request: ListChatThreadsRequest
  ): Promise<APIResponse<ListChatThreadsResponse>> {
    return Api()
      .get('/v1/orchestrator/threads', {
        params: {
          studyInstanceUID: request.studyInstanceUID,
          ...(request.limit ? { limit: request.limit } : {}),
        },
      })
      .then((response: AxiosResponse<APIResponse<ListChatThreadsResponse>>) => response.data)
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * One of the signed-in user's threads: its messages and the user's votes.
   */
  async GetChatThreadHistory(request: GetThreadRequest): Promise<APIResponse<ChatThreadHistory>> {
    return Api()
      .get(`/v1/orchestrator/threads/${encodeURIComponent(request.threadId)}/messages`)
      .then((response: AxiosResponse<APIResponse<ChatThreadHistory>>) => response.data)
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * Chat settings the viewer needs before the first message: the default answer
   * language of the chat backend (CHAT_DEFAULT_LANGUAGE), null with an older one.
   */
  async GetChatSettings(): Promise<APIResponse<ChatSettingsResponse>> {
    return Api()
      .get('/v1/orchestrator/settings')
      .then((response: AxiosResponse<APIResponse<ChatSettingsResponse>>) => response.data);
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
   * Save the caller's thumbs up/down on one chat answer (create or replace).
   */
  async SubmitChatFeedback(
    request: SubmitChatFeedbackRequest
  ): Promise<APIResponse<ChatFeedbackSaved>> {
    const { threadId, messageId, vote, category, comment } = request;
    return Api()
      .put(
        `/v1/orchestrator/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/feedback`,
        { vote, category, ...(comment ? { comment } : {}) }
      )
      .then((response: AxiosResponse<APIResponse<ChatFeedbackSaved>>) => response.data)
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * Remove the caller's vote on one chat answer.
   */
  async RemoveChatFeedback(request: RemoveChatFeedbackRequest): Promise<APIResponse<unknown>> {
    return Api()
      .delete(
        `/v1/orchestrator/threads/${encodeURIComponent(request.threadId)}/messages/${encodeURIComponent(request.messageId)}/feedback`
      )
      .then((response: AxiosResponse<APIResponse<unknown>>) => response.data)
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * The workspace's votes on chat answers, thumbs down first (feedback.view).
   */
  async ListChatFeedback(
    request: ListChatFeedbackRequest
  ): Promise<APIResponse<ListChatFeedbackResponse>> {
    return Api()
      .get(`/v1/inference/chat/feedback/list`, { params: request })
      .then((response: AxiosResponse<APIResponse<ListChatFeedbackResponse>>) => response.data)
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * One vote with the tool calls behind the rated answer (feedback.view).
   */
  async GetChatFeedback(feedbackId: string): Promise<APIResponse<ChatFeedbackDetail>> {
    return Api()
      .get(`/v1/inference/chat/feedback/${encodeURIComponent(feedbackId)}`)
      .then((response: AxiosResponse<APIResponse<ChatFeedbackDetail>>) => response.data)
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },

  /**
   * Counts of the workspace's votes on chat answers (feedback.view).
   */
  async CountChatFeedback(
    request: Pick<ListChatFeedbackRequest, 'study' | 'from' | 'to' | 'days'>
  ): Promise<APIResponse<ChatFeedbackCountsResponse>> {
    return Api()
      .get(`/v1/inference/chat/feedback/counts`, { params: request })
      .then((response: AxiosResponse<APIResponse<ChatFeedbackCountsResponse>>) => response.data)
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};

export default orchestratorRepository;
