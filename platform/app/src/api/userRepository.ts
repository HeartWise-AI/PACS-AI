import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import {
  AddTenantUserRequest,
  ChangePasswordRequest,
  DeleteTenantUserRequest,
  ForgotPasswordRequest,
  GetDoctorSpecialtiesResponse,
  GetUserMetadataResponse,
  LoginRequest,
  LoginResponse,
  UpdateTenantUserRequest,
  UpdateUserMetadataRequest,
  UserResponse,
} from './userDTO';

const userRepository = {
  /**
   * Add tenant user
   *
   * @param   {AddTenantUserRequest<APIResponse><void>}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async AddTenantUser(request: AddTenantUserRequest): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/user/add`, request)
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
   * Delete tenant user
   *
   * @param   {DeleteTenantUserRequest<APIResponse><void>}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async DeleteTenantUser(request: DeleteTenantUserRequest): Promise<APIResponse<void>> {
    return Api()
      .delete(`/v1/user/${request.userId}/remove`)
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
   * Get all tenant users
   *
   * @return  {Promise<APIResponse><UserResponse>[]}
   */
  async GetAllTenantUsers(): Promise<APIResponse<UserResponse[]>> {
    return Api()
      .get(`/v1/user/all`)
      .then((response: AxiosResponse<APIResponse<UserResponse[]>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Get doctor specialties
   *
   * @return  {Promise<APIResponse><GetDoctorSpecialtiesResponse>[]}
   */
  async GetDoctorSpecialties(): Promise<APIResponse<GetDoctorSpecialtiesResponse[]>> {
    return Api()
      .get(`/v1/user/specialties`)
      .then((response: AxiosResponse<APIResponse<GetDoctorSpecialtiesResponse[]>>) => {
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
   * Get user metadata
   *
   * @return  {Promise<APIResponse><GetUserMetadataResponse>}
   */
  async GetUserMetadata(): Promise<APIResponse<GetUserMetadataResponse>> {
    return Api()
      .get(`/v1/user/metadata`)
      .then((response: AxiosResponse<APIResponse<GetUserMetadataResponse>>) => {
        const { data } = response;

        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Reset tutorial
   *
   * @return  {Promise<APIResponse><void>}
   */
  async ResetTutorial(): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/user/tutorial/reset`)
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
  /**
   * Update tenant user
   *
   * @param   {UpdateTenantUserRequest<APIResponse><void>}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async UpdateTenantUser(request: UpdateTenantUserRequest): Promise<APIResponse<void>> {
    return Api()
      .put(`/v1/user/update`, request)
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
   * Update user metadata
   *
   * @param   {UpdateUserMetadataRequest<APIResponse><object>}  request
   *
   * @return  {Promise<APIResponse><object>}
   */
  async UpdateUserMetadata(request: UpdateUserMetadataRequest): Promise<APIResponse<object>> {
    return Api()
      .put(`/v1/user/metadata/update`, request)
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
