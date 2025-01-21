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
  disallowedDICOMTags: string[];
  outputMode: string;
  createdAt: number;
  updatedAt: number;
}

export interface GetInferenceModelInfoRequest {
  containerID: string;
}

export interface GetInferenceModelInfoResponse {
  modelName: string;
  version: string;
  dicomTargetLevel: string;
  dicomUploadMin: number;
  dicomUploadMax: number;
  supportedDicomModalities: string[];
  supportedDicomTags: string[];
  supportedAdditionalMetadata: InferenceAvailableAdditionalMetadata[];
  supportedOutputModes: string[];
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
  supportedDicomTags: string[];
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
  segmentation: {
    labelmap: string;
    dimensions: number[];
    label: string;
    segments: {
      [key: string]: number;
    };
  };
  measurements: number[];
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

export interface UpdateInferenceModelRequest {
  disallowedDICOMTags: string[];
  outputMode: string;
}
