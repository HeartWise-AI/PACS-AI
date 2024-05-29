export interface GetPublicTenantByIDResponse {
  readonly id: string;
  readonly name: string;
  readonly address: string;
}

export interface GetTenantInfoResponse {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly availableModels: Array<{ en: ModelDetails }>;
}

export interface GetPublicTenantByIDRequest {
  tenantId: string;
}

export interface ModelDetails {
  Changelogs: { [key: string]: string };
  Summary: { [key: string]: string };
  Mechanism: { [key: string]: string };
  Validation_and_performance: { [key: string]: { [key: string]: string | number } };
  Other_information: { [key: string]: string };
  Other_results: { [key: string]: string };
  Uses_and_directions: { [key: string]: string };
  Warnings_and_limitations: { [key: string]: string };
}
