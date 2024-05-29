interface Studies {
  accessionNumber: string;
  modalitiesInStudy: string;
  numberOfStudyRelatedSeries: string;
  patientBirthDate: string;
  patientID: string;
  patientName: string;
  patientSex: string;
  queryRetrieveLevel: string;
  referringPhysicianName: string;
  retrieveAETitle: string;
  specificCharacterSet: string;
  studyDate: string;
  studyDescription: string;
  studyID: string;
  studyInstanceUID: string;
  studyTime: string;
}
export interface GetModalityStudiesResponse {
  readonly queryId: string;
  readonly studies: Studies[];
}

export interface GetModalityStudiesRequest {
  accessionNumber: string;
  institutionName: string;
  modalitiesInStudy: string;
  numberOfStudyRelatedSeries: string;
  patientBirthDate: string;
  patientID: string;
  patientName: string;
  patientSex: string;
  referringPhysicianName: string;
  requestingPhysician: string;
  studyDate: string;
  studyDescription: string;
  studyID: string;
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
  jobID: string;
}
export interface RetrieveModalityStudyRequest {
  queryID: string;
  answerIndex: number;
  studyInstanceUID: string;
}

export interface RetrieveModalityStudyResponse {
  readonly id: string;
  readonly path: string;
}

export enum JobState {
  PENDING = 'Pending',
  RUNNING = 'Running',
  SUCCESS = 'Success',
  FAILURE = 'Failure',
  PAUSED = 'Paused',
  RETRY = 'Retry',
}
