import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import { ECSLogsRequest } from './ecsDTO';

const ecsRepository = {
  /**
   * Get ECS logs
   *
   * @param   {ECSLogsRequest<APIResponse>object[]<>>>}  request
   *
   * @return  {Promise<APIResponse>object[]<>>>}
   */
  async GetECSLogs(request: ECSLogsRequest): Promise<APIResponse<object[]>> {
    return Api()
      .get(`/v1/ecs/logs`, { params: request })
      .then((response: AxiosResponse<APIResponse<object[]>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};
export default ecsRepository;
