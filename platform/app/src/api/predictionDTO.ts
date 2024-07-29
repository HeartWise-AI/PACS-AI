import { int } from '@kitware/vtk.js/types';

export interface PredictionResultRequest {
  dicomUrl: string;
}
export interface PredictionResultResponse {
  DetectedVessel: string;
  LVEF: int;
  Age: int;
}
