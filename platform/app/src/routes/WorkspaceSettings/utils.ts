import moment from 'moment';
import { DataElementDictionary } from 'dicom-data-dictionary';
import { Error } from '../../api/dto';
import { GetInferenceModelResponse } from '../../api/inferenceDTO';
import { logoutUser } from '../../service/userService';
import {
  containerStatusColors,
  DEFAULT_CONTAINER_STATUS_COLORS,
  InferenceContainerStatus,
} from './constants';
import type { DICOMModalities, InferenceModelView, StatusColorClasses } from './types';

type ShowAlert = (message: string, variant: string) => void;

export function handleUnauthorizedAccess(
  error: { errorCode?: string; message?: string },
  showAlert: ShowAlert,
  navigate: (path?: string) => void,
  tenantId: string
): boolean {
  if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
    showAlert(error.message, 'error');
    setTimeout(() => {
      logoutUser(navigate, tenantId);
    }, 3000);
    return true;
  }
  return false;
}

export function buildTimestampFromDateAndTime(
  date: moment.Moment | null,
  time: string
): number {
  if (!date) {
    return 0;
  }
  const [hours, minutes] = time.split(':').map(Number);
  return date.clone().startOf('day').hours(hours).minutes(minutes).unix();
}

export function mapOrthancModalities(
  modalities: Record<string, any>
): DICOMModalities[] {
  return Object.entries(modalities).map(([id, modality]: [string, any]) => ({
    id,
    aet: modality.aet,
    host: modality.host,
    port: modality.port,
    status: 'Connecting',
    targetCFindEnabled: modality.targetCFindEnabled,
    targetCMoveEnabled: modality.targetCMoveEnabled,
    targetCStoreEnabled: modality.targetCStoreEnabled,
  }));
}

export function transformInferenceModels(
  models: GetInferenceModelResponse[]
): InferenceModelView[] {
  return models
    .map(model => ({
      ...model,
      envs: (model.envs as string[]).map(env => ({
        key: env.split('=')[0],
        value: env.split('=')[1],
      })),
    }))
    .sort(
      (a, b) =>
        new Date(b.container.startedAt).getTime() - new Date(a.container.startedAt).getTime()
    );
}

export function formatEnvsForApi(envs: { key: string; value: string }[]): string[] {
  return envs.map(env => `${env.key}=${env.value}`);
}

export function getContainerStatusColor(status: string): StatusColorClasses {
  return (
    containerStatusColors[status.toLowerCase() as InferenceContainerStatus] ||
    DEFAULT_CONTAINER_STATUS_COLORS
  );
}

export function getDockerImageVersion(dockerImage?: string): string {
  return dockerImage?.split(':')[1] || '';
}

export function getDICOMTagsName(tag: string): string {
  const dictionary = new DataElementDictionary();
  const element = dictionary.lookup(tag);
  return element ? element.name : 'Unknown Tag';
}
