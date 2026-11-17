import { GetInferenceModelResponse } from '../../api/inferenceDTO';

export interface DICOMModalities {
  id: string;
  aet: string;
  host: string;
  port: number;
  status: string;
  targetCFindEnabled: boolean;
  targetCMoveEnabled: boolean;
  targetCStoreEnabled: boolean;
}

export type ModalityFormState = {
  id: string;
  aet: string;
  host: string;
  port: string;
  status: string;
  targetCFindEnabled: boolean;
  targetCMoveEnabled: boolean;
  targetCStoreEnabled: boolean;
};

export type InferenceModelEnv = { key: string; value: string };

export type InferenceModelView = Omit<GetInferenceModelResponse, 'envs'> & {
  envs: InferenceModelEnv[];
};

export type TableHeader = {
  text: string;
  value: string;
  align: string;
};

export type StatusColorClasses = {
  bg: string;
  bgOpacity: string;
  text: string;
  dot: string;
};

export type IngestionScheduleType = 'always' | 'dateRange';

export type SelectOption = { value: string; label: string };
