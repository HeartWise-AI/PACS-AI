import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  GetPublicTenantByIDRequest,
  GetPublicTenantByIDResponse,
  LoginRequest,
  LoginResponse,
  UserResponse,
} from './userDTO';

const userRepository = {
  /**
   * Forgot password
   *
   * @param   {ForgotPasswordRequest<APIResponse><void>}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async ForgotPassword(request: ForgotPasswordRequest): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/iam/forgot-password`, request)
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
   * User login
   *
   * @param   {LoginRequest<APIResponse><LoginResponse>}  request
   *
   * @return  {Promise<APIResponse><LoginResponse>}
   */
  async Login(request: LoginRequest): Promise<APIResponse<LoginResponse>> {
    return Api()
      .post(`/v1/iam/login`, request)
      .then((response: AxiosResponse<APIResponse<LoginResponse>>) => {
        const { data } = response;

        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get current user info
   *
   * @return  {Promise<APIResponse><UserResponse>}
   */
  async GetCurrentUser(): Promise<APIResponse<UserResponse>> {
    return Api()
      .get(`/v1/user/me`)
      .then((response: AxiosResponse<APIResponse<UserResponse>>) => {
        const { data } = response;

        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Update user password
   *
   * @param   {ChangePasswordRequest<APIResponse><>>>}  request
   *
   * @return  {Promise<APIResponse><>>>}
   */
  async UpdatePassword(request: ChangePasswordRequest): Promise<APIResponse<object>> {
    return Api()
      .put(`/v1/user/password/update`, request)
      .then((response: AxiosResponse<APIResponse<object>>) => {
        const { data } = response;

        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};

export default userRepository;
