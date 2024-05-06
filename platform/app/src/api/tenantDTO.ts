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
}

export interface GetPublicTenantByIDRequest {
  tenantId: string;
}
