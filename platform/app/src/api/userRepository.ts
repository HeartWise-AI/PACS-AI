import type { AxiosResponse, AxiosError } from 'axios'
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import { LoginRequest, LoginResponse, UserResponse } from './userDTO';

export default {
  /**
   * User login
   *
   * @param   {LoginRequest<APIResponse><LoginResponse>}  request
   *
   * @return  {Promise<APIResponse><LoginResponse>}
   */
  Login(request: LoginRequest): Promise<APIResponse<LoginResponse>> {
    return Api()
      .post(`/v1/iam/login`, request)
      .then((response: AxiosResponse<APIResponse<LoginResponse>>) => {
        const {data} = response

        return data
      }).catch((error:AxiosError<ErrorAPIResponse>) => {
        const { response } = error
        throw response?.data !== undefined ? response.data : {}
      })
  },
  /**
   * Get current user info
   *
   * @return  {Promise<APIResponse><UserResponse>}
   */
  GetCurrentUser(): Promise<APIResponse<UserResponse>> {
    return Api()
      .get(`/v1/user/me`)
      .then((response: AxiosResponse<APIResponse<UserResponse>>) => {
        const {data} = response

        return data
      }).catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error
        throw response?.data !== undefined ? response.data : {}
      })
  },
};
