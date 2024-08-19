export interface PredictionResultRequest {
  queryId: string;
}
export interface PredictionResultResponse {
  vessel: string;
  LVEF: number;
  age: number;
}
