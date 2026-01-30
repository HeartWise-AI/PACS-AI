import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import Api from '../pacsAPIAxios';
import { APIResponse, ErrorAPIResponse } from './dto';
import {
  AddInferenceModelRequest,
  DeleteInferenceModelRequest,
  GetInferenceAvailableModelsResponse,
  GetInferenceModelFactsRequest,
  GetInferenceModelFactsResponse,
  GetInferenceModelInfoRequest,
  GetInferenceModelInfoResponse,
  GetInferenceModelResponse,
  GetModelFeedbackByModelIDRequest,
  GetModelFeedbackByModelIDResponse,
  PredictInferenceModelRequest,
  RemoveModelFeedbackRequest,
  StartInferenceModelContainerRequest,
  StopInferenceModelContainerRequest,
  UpdateInferenceModelRequest,
  UpdateModelFeedbackRequest,
} from './inferenceDTO';

const inferenceRepository = {
  /**
   * Add inference model
   *
   * @param   {AddInferenceModelRequest}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async AddInferenceModel(request: AddInferenceModelRequest): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/inference/model/add`, request)
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
   * Delete inference model
   *
   * @param   {DeleteInferenceModelRequest}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async DeleteInferenceModel(request: DeleteInferenceModelRequest): Promise<APIResponse<void>> {
    return Api()
      .delete(`/v1/inference/model/${request.id}/remove`)
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
   * Get inference models
   *
   * @return  {Promise<APIResponse><GetInferenceModelResponse>}
   */
  async GetInferenceModels(): Promise<APIResponse<GetInferenceModelResponse[]>> {
    return Api()
      .get(`/v1/inference/model/list`)
      .then((response: AxiosResponse<APIResponse<GetInferenceModelResponse[]>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get inference model info
   *
   * @param   {GetInferenceModelInfoRequest}  request
   *
   * @return  {Promise<APIResponse><GetInferenceModelInfoResponse>}
   */
  async GetInferenceModelInfo(
    request: GetInferenceModelInfoRequest
  ): Promise<APIResponse<GetInferenceModelInfoResponse>> {
    return Api()
      .get(`/v1/inference/model/proxy/container/${request.containerID}/info`)
      .then((response: AxiosResponse<APIResponse<GetInferenceModelInfoResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get inference model facts
   *
   * @param   {GetInferenceModelFactsRequest}  request
   *
   * @return  {Promise<APIResponse><GetInferenceModelFactsResponse>}
   */
  async GetInferenceModelFacts(
    request: GetInferenceModelFactsRequest
  ): Promise<APIResponse<GetInferenceModelFactsResponse>> {
    return Api()
      .get(`/v1/inference/model/proxy/container/${request.containerID}/facts`)
      .then((response: AxiosResponse<APIResponse<GetInferenceModelFactsResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get inference available models
   *
   * @return  {Promise<APIResponse><GetInferenceAvailableModelsResponse>}
   */
  async GetInferenceAvailableModels(): Promise<APIResponse<GetInferenceAvailableModelsResponse[]>> {
    return Api()
      .get(`/v1/inference/model/proxy/available`)
      .then((response: AxiosResponse<APIResponse<GetInferenceAvailableModelsResponse[]>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get model feedback by model ID
   *
   * @param   {GetModelFeedbackByModelIDRequest}  request
   *
   * @return  {Promise<APIResponse><GetModelFeedbackByModelIDResponse>}
   */
  async GetModelFeedbackByModelID(
    request: GetModelFeedbackByModelIDRequest
  ): Promise<APIResponse<GetModelFeedbackByModelIDResponse>> {
    return Api()
      .get(`/v1/inference/model/${request.modelId}/feedback`)
      .then((response: AxiosResponse<APIResponse<GetModelFeedbackByModelIDResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Predict inference model
   *
   * @param   {PredictInferenceModelRequest}  request
   *
   * @return  {Promise<APIResponse><T>}
   */
  async PredictInferenceModel<T>(
    containerId: string,
    request: PredictInferenceModelRequest
  ): Promise<APIResponse<T>> {
    return Api()
      .post(`/v1/inference/model/proxy/container/${containerId}/predict`, request)
      .then((response: AxiosResponse<APIResponse<T>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Remove model feedback
   *
   * @param   {RemoveModelFeedbackRequest}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async RemoveModelFeedback(request: RemoveModelFeedbackRequest): Promise<APIResponse<void>> {
    return Api()
      .delete(`/v1/inference/model/${request.modelId}/feedback/remove`)
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
   * Start inference model container
   *
   * @param   {StartInferenceModelContainerRequest}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async StartInferenceModelContainer(
    request: StartInferenceModelContainerRequest
  ): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/inference/model/container/${request.containerID}/start`, request)
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
   * Stop inference model container
   *
   * @param   {StopInferenceModelContainerRequest}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async StopInferenceModelContainer(
    request: StopInferenceModelContainerRequest
  ): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/inference/model/container/${request.containerID}/stop`, request)
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
   * Update inference model
   *
   * @param   {UpdateInferenceModelRequest}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async UpdateInferenceModel(
    containerID: string,
    request: UpdateInferenceModelRequest
  ): Promise<APIResponse<void>> {
    return Api()
      .put(`/v1/inference/model/${containerID}/update`, request)
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
   * Update model feedback
   *
   * @param   {UpdateModelFeedbackRequest<APIResponse><void>}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async UpdateModelFeedback(request: UpdateModelFeedbackRequest): Promise<APIResponse<void>> {
    return Api()
      .put(`/v1/inference/model/feedback/update`, request)
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
export default inferenceRepository;
