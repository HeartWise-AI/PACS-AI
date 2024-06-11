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
  LOGINS = 'logins',
  ADMIN_MEMBERS = 'admin_members',
  FIND_MODALITY_STUDIES = 'find_modality_studies',
  RETRIEVED_STUDIES = 'retrieved_studies',
}
