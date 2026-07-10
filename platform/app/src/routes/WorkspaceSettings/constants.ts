import type {
  InferenceModelView,
  ModalityFormState,
  StatusColorClasses,
  TableHeader,
} from './types';

export enum InferenceContainerStatus {
  CREATED = 'created',
  RUNNING = 'running',
  PAUSED = 'paused',
  RESTARTING = 'restarting',
  EXITED = 'exited',
  REMOVING = 'removing',
  DEAD = 'dead',
  STOPPED = 'stopped',
}

export const containerStatusColors: Record<InferenceContainerStatus, StatusColorClasses> = {
  [InferenceContainerStatus.CREATED]: {
    bg: 'bg-blue-300',
    bgOpacity: 'bg-opacity-20',
    text: 'text-blue-300',
    dot: 'bg-blue-300',
  },
  [InferenceContainerStatus.RUNNING]: {
    bg: 'bg-[#6ED47C]',
    bgOpacity: 'bg-opacity-20',
    text: 'text-[#6ED47C]',
    dot: 'bg-[#6ED47C]',
  },
  [InferenceContainerStatus.PAUSED]: {
    bg: 'bg-yellow-300',
    bgOpacity: 'bg-opacity-20',
    text: 'text-yellow-300',
    dot: 'bg-yellow-300',
  },
  [InferenceContainerStatus.RESTARTING]: {
    bg: 'bg-purple-300',
    bgOpacity: 'bg-opacity-20',
    text: 'text-purple-300',
    dot: 'bg-purple-300',
  },
  [InferenceContainerStatus.EXITED]: {
    bg: 'bg-red-300',
    bgOpacity: 'bg-opacity-10',
    text: 'text-red-500',
    dot: 'bg-red-500',
  },
  [InferenceContainerStatus.REMOVING]: {
    bg: 'bg-orange-300',
    bgOpacity: 'bg-opacity-20',
    text: 'text-orange-300',
    dot: 'bg-orange-300',
  },
  [InferenceContainerStatus.DEAD]: {
    bg: 'bg-red-500',
    bgOpacity: 'bg-opacity-20',
    text: 'text-red-500',
    dot: 'bg-red-500',
  },
  [InferenceContainerStatus.STOPPED]: {
    bg: 'bg-red-300',
    bgOpacity: 'bg-opacity-10',
    text: 'text-red-500',
    dot: 'bg-red-500',
  },
};

export const DEFAULT_CONTAINER_STATUS_COLORS: StatusColorClasses = {
  bg: 'bg-gray-300',
  bgOpacity: 'bg-opacity-20',
  text: 'text-gray-300',
  dot: 'bg-gray-300',
};

export const minIngestionJobIntervalMinutes = 5;

export const POLLING_INTERVAL_MS = 15000;

export const outputModeOptions = ['JSON', 'OHIF_ANNOTATIONS', 'HTML', 'WEB_APP', 'PDF'];

export const DEFAULT_JOB_START_TIME = '00:00';

export const DEFAULT_JOB_END_TIME = '23:59';

export const EMPTY_MODALITY_FORM: ModalityFormState = {
  id: '',
  aet: '',
  host: '',
  port: '',
  status: '',
  targetCFindEnabled: false,
  targetCMoveEnabled: false,
  targetCStoreEnabled: false,
};

export const EMPTY_INFERENCE_MODEL: InferenceModelView = {
  id: '',
  name: '',
  dockerImage: '',
  tenantId: '',
  outputMode: '',
  envs: [],
  createdAt: 0,
  updatedAt: 0,
  container: {
    id: '',
    name: '',
    status: '',
    running: false,
    startedAt: 0,
    finishedAt: 0,
    cpuPercentUsage: 0,
    memoryInBytes: 0,
  },
  disallowedDICOMTags: [],
};

type TranslateFn = (key: string) => string;

export const getDicomHeaders = (t: TranslateFn): TableHeader[] => [
  { text: t('ID'), value: 'id', align: 'left' },
  { text: t('Target AET'), value: 'aet', align: 'left' },
  { text: t('Host'), value: 'host', align: 'left' },
  { text: t('Port'), value: 'port', align: 'left' },
  { text: t('C-Find'), value: 'targetCFindEnabled', align: 'left' },
  { text: t('C-Move'), value: 'targetCMoveEnabled', align: 'left' },
  { text: t('C-Store'), value: 'targetCStoreEnabled', align: 'left' },
  { text: t('Status'), value: 'status', align: 'left' },
  { text: t('Action'), value: 'action', align: 'center' },
];

export const getInferenceModelHeaders = (t: TranslateFn): TableHeader[] => [
  { text: t('Container ID'), value: 'containerId', align: 'left' },
  { text: t('Name'), value: 'name', align: 'left' },
  { text: t('Version'), value: 'version', align: 'left' },
  { text: t('Image'), value: 'dockerImage', align: 'left' },
  { text: t('Status'), value: 'status', align: 'left' },
  { text: t('CPU %'), value: 'cpu', align: 'left' },
  { text: t('Action'), value: 'action', align: 'center' },
];

export const getIngestionJobHeaders = (t: TranslateFn): TableHeader[] => [
  { text: t('Job ID'), value: 'jobId', align: 'left' },
  { text: t('Model'), value: 'model', align: 'left' },
  { text: t('DICOM Modality'), value: 'dicomModality', align: 'left' },
  { text: t('Modalities'), value: 'modalities', align: 'left' },
  { text: t('Interval'), value: 'interval', align: 'left' },
  { text: t('Schedule'), value: 'schedule', align: 'left' },
  { text: t('Status'), value: 'status', align: 'left' },
  { text: t('Action'), value: 'action', align: 'center' },
];
