import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import {
  AddTenantUserRequest,
  ChangeTenantUserAccessRequest,
  ChangeTenantUserAccessResponse,
  ChangePasswordRequest,
  DeleteTenantUserRequest,
  ForgotPasswordRequest,
  GetDoctorSpecialtiesResponse,
  GetTenantUserEmailInvitesResponse,
  GetUserMetadataResponse,
  InviteTenantUserRequest,
  LoginRequest,
  LoginResponse,
  RegisterTenantUserRequest,
  RemoveTenantUserEmailInviteRequest,
  ResendTenantInvitationRequest,
  UpdateTenantUserRequest,
  UpdateUserMetadataRequest,
  UserResponse,
  VerifyEmailRequest,
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
   * Suspend a tenant user's access and revoke their active sessions.
   */
  async SuspendTenantUser(
    request: ChangeTenantUserAccessRequest
  ): Promise<APIResponse<ChangeTenantUserAccessResponse>> {
    return Api()
      .post(`/v1/user/${encodeURIComponent(request.userId)}/suspend`, {
        reason: request.reason,
      })
      .then((response: AxiosResponse<APIResponse<ChangeTenantUserAccessResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
  /**
   * Reactivate a tenant user's access.
   */
  async ReactivateTenantUser(
    request: ChangeTenantUserAccessRequest
  ): Promise<APIResponse<ChangeTenantUserAccessResponse>> {
    return Api()
      .post(`/v1/user/${encodeURIComponent(request.userId)}/reactivate`, {
        reason: request.reason,
      })
      .then((response: AxiosResponse<APIResponse<ChangeTenantUserAccessResponse>>) => {
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
   * Send tenant user email verification
   *
   * @param   {VerifyEmailRequest<APIResponse><void>}  request
   *
   * @return  {Promise<APIResponse><void>}
   */
  async VerifyEmail(request: VerifyEmailRequest): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/iam/verify-email`, request)
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
   * Invite tenant user
   *
   * @param   {InviteTenantUserRequest<APIResponse><object>}  request
   *
   * @return  {Promise<APIResponse><object>}
   */
  async InviteTenantUser(request: InviteTenantUserRequest): Promise<APIResponse<object>> {
    return Api()
      .post(`/v1/user/invite`, request)
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
   * Get tenant user email invites
   *
   * @return  {Promise<APIResponse><GetTenantUserEmailInvitesResponse[]>}
   */
  async GetTenantUserEmailInvites(): Promise<APIResponse<GetTenantUserEmailInvitesResponse[]>> {
    return Api()
      .get(`/v1/user/invites`)
      .then((response: AxiosResponse<APIResponse<GetTenantUserEmailInvitesResponse[]>>) => {
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
   * Register tenant user
   *
   * @param   {RegisterTenantUserRequest<APIResponse><object>}  request
   *
   * @return  {Promise<APIResponse><object>}
   */
  async RegisterTenantUser(request: RegisterTenantUserRequest): Promise<APIResponse<object>> {
    return Api()
      .post(`/v1/user/register`, request)
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
   * Resend tenant invitation
   *
   * @param   {ResendTenantInvitationRequest<APIResponse><object>}  request
   *
   * @return  {Promise<APIResponse><object>}
   */
  async ResendTenantInvitation(
    request: ResendTenantInvitationRequest
  ): Promise<APIResponse<object>> {
    return Api()
      .post(`/v1/user/invite/resend`, request)
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
   * Remove tenant user email invite
   *
   * @param   {RemoveTenantUserEmailInviteRequest<APIResponse><object>}  request
   *
   * @return  {Promise<APIResponse><object>}
   */
  async RemoveTenantUserEmailInvite(
    request: RemoveTenantUserEmailInviteRequest
  ): Promise<APIResponse<object>> {
    return Api()
      .delete(`/v1/user/invite/${request.id}/remove`)
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
