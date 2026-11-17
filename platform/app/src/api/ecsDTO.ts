export interface loginLogs {
  sessionId: string;
  tenantId: string;
  tenantName: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  specialty: string;
  timestamp: number;
}

export interface ECSLogsRequest {
  index: string;
  query: string;
  startDate: string;
  endDate: string;
  export?: boolean;
}

export enum LogsType {
  ADMIN_INVITES = 'admin_invites',
  ADMIN_MEMBERS = 'admin_members',
  LOGINS = 'logins',
  FIND_MODALITY_STUDIES = 'find_modality_studies',
  PREDICT_INFERENCE_MODELS = 'predict_inference_models',
  RETRIEVED_STUDIES = 'retrieved_studies',
  SIGNED_CONSENTS = 'signed_consents',
  STORED_CUSTOM_SERIES = 'stored_custom_series',
}
