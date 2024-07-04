export interface PredictionResultRequest {
  seriesInstanceUID: string;
  instanceUID: string;
  detectedVessel: string;
  prediction: string;
  age: string;
}
export interface PredictionResultResponse {
  seriesInstanceUID: string;
  instanceUID: string;
  detectedVessel: string;
  prediction: string;
  age: string;
}
