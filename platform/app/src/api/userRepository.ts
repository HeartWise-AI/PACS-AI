import type { AxiosResponse, AxiosError } from 'axios';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  UserResponse,
} from './userDTO';

export default {
  /**
   * Forgot password
   *
   * @param   {ForgotPasswordRequest<APIResponse><void>}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  ForgotPassword(request: ForgotPasswordRequest): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/iam/forgot-password`, request)
      .then((response: AxiosResponse<APIResponse<void>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : {};
      });
  },
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
        const { data } = response;

        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : {};
      });
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
        const { data } = response;

        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : {};
      });
  },
  /**
   * Update user password
   *
   * @param   {ChangePasswordRequest<APIResponse><>>>}  request
   *
   * @return  {Promise<APIResponse><>>>}
   */
  UpdatePassword(request: ChangePasswordRequest): Promise<APIResponse<{}>> {
    return Api()
      .put(`/v1/user/password/update`, request)
      .then((response: AxiosResponse<APIResponse<{}>>) => {
        const { data } = response;

        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : {};
      });
  },
};
