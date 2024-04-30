export interface ChangePasswordRequest {
  id: string;
  tenantId: string;
  newPassword: string;
}
export interface LoginRequest {
  tenantId: string;
  idToken: string;
}

export interface LoginResponse {
  readonly sessionToken: string;
}

export interface UserResponse {
  readonly id: string;
  readonly tenantId: string;
  readonly role: string;
  readonly name: string;
  readonly email: string;
  readonly licenseNo: number;
  readonly specialty: string;
  readonly isEmailVerified: boolean;
  readonly isAccountDisabled: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}
