import type { AxiosResponse, AxiosError } from 'axios';
import { object } from 'prop-types';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import { PredictionResultRequest, PredictionResultResponse } from './predictionDTO';

const predictionRepository = {
  /**
   * Get prediction result
   *   *
   * @return  {GetPredictionResultResponse}
   **/
  async GetPredictionResult(
    request: PredictionResultRequest
  ): Promise<APIResponse<PredictionResultResponse>> {
    return Api()
      .post(`test`, { params: request }) // This should be replaced with the actual endpoint
      .then((response: AxiosResponse<APIResponse<object[]>>) => {
        const { data } = response;
        return data as unknown as APIResponse<PredictionResultResponse>; // Explicitly cast the response data
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};
export default predictionRepository;
