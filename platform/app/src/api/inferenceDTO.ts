import { ModelDetails } from './tenantDTO';

export interface AddInferenceModelRequest {
  name: string;
  dockerImage: string;
  envs: string[];
  outputMode: string;
}

export interface DeleteInferenceModelRequest {
  id: string;
}

export interface GetInferenceModelResponse {
  id: string;
  tenantId: string;
  container: {
    id: string;
    name: string;
    status: string;
    running: boolean;
    startedAt: number;
    finishedAt: number;
    cpuPercentUsage: number;
    memoryInBytes: number;
  };
  name: string;
  dockerImage: string;
  envs: { key: string; value: string }[] | string[];
  outputMode: string;
  createdAt: number;
  updatedAt: number;
}

export interface GetInferenceModelFactsRequest {
  containerID: string;
}

export interface GetInferenceModelFactsResponse {
  en: ModelDetails;
}

export interface GetInferenceAvailableModelsResponse {
  containerId: string;
  containerName: string;
  modelName: string;
  version: string;
  dicomTargetLevel: string;
  dicomUploadMin: number;
  dicomUploadMax: number;
  supportedDicomModalities: string[];
  outputMode: string;
}

export interface PredictInferenceModelRequest {
  containerID: string;
  queryIDs: string[];
  outputMode: string;
}

export interface PredictionValue {
  index: number;
  value: number;
}

export interface VesselValue {
  index: number;
  vessel: string;
}

export interface PredictionDetail {
  probability?: number;
  confidence?: string;
  presentable?: boolean;
  displayResult?: string | number;
  values?: PredictionValue[];
}

export interface ModelRecommendations {
  en: string;
  fr: string;
  presentable: boolean;
}

export interface PredictInferenceModelJSONResponse {
  diagnosis?: string | null;
  predictions: {
    [key: string]: PredictionDetail | VesselValue[];
  };
  modelRecommendations: ModelRecommendations;
}
export interface PredictInferenceModelOHIFResponse {
  metadata: {
    [key: string]: string;
  };
  segmentations: string[];
  boundingBoxes: string[];
  measurements: string[];
}

export interface PredictInferenceModelHTMLResponse {
  htmlBase64: string;
}

export interface PredictInferenceModelPDFResponse {
  pdfBase64: string;
}

export interface PredictInferenceModelWebappResponse {
  webappPath: string;
  webappDataBase64: string;
}

export interface StartInferenceModelContainerRequest {
  containerID: string;
}

export interface StopInferenceModelContainerRequest {
  containerID: string;
}
