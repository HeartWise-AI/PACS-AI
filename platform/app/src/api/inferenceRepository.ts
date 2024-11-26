import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import Api from '../pacsAPIAxios';
import { APIResponse, ErrorAPIResponse } from './dto';
import {
  AddInferenceModelRequest,
  DeleteInferenceModelRequest,
  GetInferenceModelResponse,
  StartInferenceModelContainerRequest,
  StopInferenceModelContainerRequest,
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
};
export default inferenceRepository;
