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
  supportedAdditionalMetadata: InferenceAvailableAdditionalMetadata[];
  outputMode: string;
  modelFacts: {
    en: ModelDetails;
  };
}

export interface ModelDetails {
  Changelogs: { [key: string]: string } | string;
  Summary: { [key: string]: string };
  Mechanism: { [key: string]: string } | string;
  Validation_and_performance: { [key: string]: { [key: string]: string | number } } | string;
  Other_information: { [key: string]: string } | string;
  Other_results: { [key: string]: string } | string;
  Uses_and_directions: { [key: string]: string } | string;
  Warnings_and_limitations: { [key: string]: string };
}

export interface InferenceAvailableAdditionalMetadata {
  id: string;
  name: string;
  type: string;
  required: boolean;
}

export interface PredictInferenceModelRequest {
  studyInstanceUID: string;
  seriesInstanceUIDs: string[];
  additionalMetadata: { [key: string]: string | null };
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
