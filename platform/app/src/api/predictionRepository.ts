import type { AxiosResponse, AxiosError } from 'axios';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import { PredictionResultRequest, PredictionResultResponse } from './predictionDTO';
import { object } from 'prop-types';

const predictionRepository = {
  /**
   * Apply prediction
   *
   * @return  {PredictionResultResponse}
   */
  async ApplyPrediction(
    request: PredictionResultRequest
  ): Promise<APIResponse<PredictionResultResponse>> {
    return await Api()
      .post('/v1/prediction/apply', request)
      .then((response: AxiosResponse<APIResponse<PredictionResultResponse>>) => {
        const { data } = response;
        return data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : object;
      });
  },
};
export default predictionRepository;
