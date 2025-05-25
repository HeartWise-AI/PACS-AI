interface Studies {
  accessionNumber: string;
  modalitiesInStudy: string;
  numberOfStudyRelatedSeries: string;
  patientBirthDate: string;
  patientId: string;
  patientName: string;
  patientSex: string;
  queryRetrieveLevel: string;
  referringPhysicianName: string;
  retrieveAETitle: string;
  specificCharacterSet: string;
  studyDate: string;
  studyDescription: string;
  studyId: string;
  studyInstanceUID: string;
  studyTime: string;
}

export interface GetLocalResourceRequest {
  sopInstanceUID: string;
}

export interface GetLocalResourceResponse {
  queryIds: string[];
}

export interface GetModalityStudiesResponse {
  readonly queryId: string;
  readonly studies: Studies[];
}

export interface GetModalityStudiesRequest {
  modalityId: string;
  accessionNumber: string;
  institutionName: string;
  modalitiesInStudy: string;
  numberOfStudyRelatedSeries: string;
  patientBirthDate: string;
  patientId: string;
  patientName: string;
  patientSex: string;
  referringPhysicianName: string;
  requestingPhysician: string;
  studyDate: string;
  studyDescription: string;
  studyId: string;
  studyInstanceUID: string;
  studyTime: string;
}

export interface GetJobInfoResponse {
  readonly id: string;
  readonly priority: number;
  readonly progress: number;
  readonly state: string;
}

export interface GetJobInfoRequest {
  jobIds: string[];
}

export interface GetDICOMModalitiesResponse {
  modalities: {
    [key: string]: {
      tenantId: string;
      modalityId: string;
      aet: string;
      allowEcho: boolean;
      allowFind: boolean;
      allowFindWorklist: boolean;
      allowGet: boolean;
      allowMove: boolean;
      allowStore: boolean;
      allowTranscoding: boolean;
      host: string;
      port: number;
      timeout: number;
      useDicomTLS: boolean;
      targetCFindEnabled: boolean;
      targetCMoveEnabled: boolean;
      targetCStoreEnabled: boolean;
    };
  };
}

export interface GetLnkedDICOMModalityWithEnabledCStoreRequest {
  modalityId: string;
}

export interface GetLnkedDICOMModalityWithEnabledCStoreResponse {
  readonly id: string;
  readonly tenantId: string;
  readonly modalityId: string;
  readonly aet: string;
  readonly hostHash: string;
  readonly cFindEnabled: boolean;
  readonly cMoveEnabled: boolean;
  readonly cStoreEnabled: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface RetrieveModalityStudyRequest {
  modalityId: string;
  studyInstanceUID: string;
}

export interface RetrieveModalityStudyResponse {
  readonly id: string;
  readonly path: string;
}

export interface RemoveDICOMModalityRequest {
  modalityId: string;
}

export interface StoreStudyCustomSeriesRequest {
  modalityID: string;
  studyInstanceUID: string;
  seriesInstanceUIDs: string;
  patientID: string;
  patientName: string;
  modelName: string;
  modelVersion: string;
  file: Blob;
}

export interface TriggerDICOMEchoSCURequest {
  modalityId: string;
}

export interface UpdateDICOMModalityRequest {
  modalityId: string;
  aet: string;
  host: string;
  port: number;
  cFindEnabled: boolean;
  cMoveEnabled: boolean;
  cStoreEnabled: boolean;
}

export enum JobState {
  PENDING = 'Pending',
  RUNNING = 'Running',
  SUCCESS = 'Success',
  FAILURE = 'Failure',
  PAUSED = 'Paused',
  RETRY = 'Retry',
}
