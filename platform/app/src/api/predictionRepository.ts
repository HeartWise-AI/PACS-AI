import type { AxiosResponse, AxiosError } from 'axios';
import { APIResponse, ErrorAPIResponse } from './dto';
import Api from '../pacsAPIAxios';
import { PredictionResultRequest, PredictionResultResponse } from './predictionDTO';

const predictionRepository = {
  async GetPredictionResult(
    request: PredictionResultRequest
  ): Promise<APIResponse<PredictionResultResponse>> {
    const findQueryResponse = await Api().post('v1/orthanc/tools/find', {
      Level: 'Instances',
      Query: { SOPInstanceUID: request.dicomUID },
    });
    const queryID = findQueryResponse.data.data;
    return await Api()
      .post('v1/prediction', { ...request, queryID })
      .then((response: AxiosResponse<APIResponse<PredictionResultResponse>>) => {
        return response.data;
      })
      .catch((error: AxiosError<ErrorAPIResponse>) => {
        const { response } = error;
        throw response?.data !== undefined ? response.data : new Error('An unknown error occurred');
      });
  },
};
export default predictionRepository;
