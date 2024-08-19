import type { AxiosResponse, AxiosError } from 'axios';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import { PredictionRequest, PredictionResponse } from './predictionDTO';
import { object } from 'prop-types';

const predictionRepository = {
  /**
   * Apply prediction
   *
   * @return  {PredictionResponse}
   */
  async ApplyPrediction(request: PredictionRequest): Promise<APIResponse<PredictionResponse>> {
    return await Api()
      .post('/v1/prediction/apply', request)
      .then((response: AxiosResponse<APIResponse<PredictionResponse>>) => {
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
