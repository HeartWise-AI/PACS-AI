import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import {
  GetPublicTenantByIDRequest,
  GetPublicTenantByIDResponse,
  GetTenantInfoResponse,
} from './tenantDTO';

const tenantRepository = {
  /**
   * Get public tenant by ID
   *
   * @return  {GetPublicTenantByIDResponse}
   */
  async GetPublicTenantByID(
    request: GetPublicTenantByIDRequest
  ): Promise<APIResponse<GetPublicTenantByIDResponse>> {
    return Api()
      .get(`/v1/tenant/public`, { params: request })
      .then((response: AxiosResponse<APIResponse<GetPublicTenantByIDResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get tenant info
   *
   * @return  {GetTenantInfoResponse}
   */
  async GetTenantInfo(): Promise<APIResponse<GetTenantInfoResponse>> {
    return Api()
      .get(`/v1/tenant`)
      .then((response: AxiosResponse<APIResponse<GetTenantInfoResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};

export default tenantRepository;
