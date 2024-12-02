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

export interface PredictInferenceModelJSONResponse {
  diagnosis: string;
  predictions: {
    [key: string]: {
      probability: number;
      confidence: string;
      presentable: boolean;
      displayResult: string;
    };
  };
  modelRecommendations: {
    en: string;
    fr: string;
    presentable: boolean;
  };
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
