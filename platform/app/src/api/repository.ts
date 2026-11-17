import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse, GetAPIInfoResponse } from './dto';
import Api from '../pacsAPIAxios';

const repository = {
  /**
   * Get API Info
   *
   * @return  {Promise<APIResponse><GetAPIInfoResponse>}
   */
  async GetAPIInfo(): Promise<APIResponse<GetAPIInfoResponse>> {
    return Api()
      .get(`/`)
      .then((response: AxiosResponse<APIResponse<GetAPIInfoResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};

export default repository;
