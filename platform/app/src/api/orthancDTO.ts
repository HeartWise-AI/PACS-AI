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
  level: string;
  query: { SOPInstanceUID: string };
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
  jobIDs: string[];
}

export interface GetDICOMModalitiesResponse {
  modalities: {
    [key: string]: {
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
    };
  };
}

export interface RetrieveModalityStudyRequest {
  aet: string;
  studyInstanceUID: string;
}

export interface RetrieveModalityStudyResponse {
  readonly id: string;
  readonly path: string;
}

export interface RemoveDICOMModalityRequest {
  modalityID: string;
}

export interface TriggerDICOMEchoSCURequest {
  modalityID: string;
}

export interface UpdateDICOMModalityRequest {
  modalityID: string;
  aet: string;
  host: string;
  port: number;
}

export enum JobState {
  PENDING = 'Pending',
  RUNNING = 'Running',
  SUCCESS = 'Success',
  FAILURE = 'Failure',
  PAUSED = 'Paused',
  RETRY = 'Retry',
}
