import { int } from '@kitware/vtk.js/types';

export interface PredictionResultRequest {
  detectedVessel: string;
  prediction: int;
  age: int;
}
export interface PredictionResultResponse {
  detectedVessel: string;
  prediction: int;
  age: int;
}
