import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import {
  AddOnboardingQuestionnaireAnswersRequest,
  GetOnboardingQuestionnaireAnswersRequest,
  GetPublicTenantByIDRequest,
  GetPublicTenantByIDResponse,
  GetTenantInfoResponse,
} from './tenantDTO';

const tenantRepository = {
  /**
   * Add onboarding questionnaire answers
   *
   * @return  {void}
   */
  async AddOnboardingQuestionnaireAnswers(
    request: AddOnboardingQuestionnaireAnswersRequest
  ): Promise<APIResponse<void>> {
    return Api()
      .post(`/v1/tenant/onboarding-questionnaire-answers/add`, request)
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
  /**
   * Get onboarding questionnaire answeres
   *
   * @return  {object}
   */
  async GetOnboardingQuestionnaireAnswers(
    request: GetOnboardingQuestionnaireAnswersRequest
  ): Promise<APIResponse<object>> {
    return Api()
      .get(`/v1/tenant/onboarding-questionnaire-answers`, { params: request })
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

export default tenantRepository;
