export interface PredictionRequest {
  queryId: string;
}

export interface PredictionResponse {
  vessel: string;
  LVEF: number;
  age: number;
}
