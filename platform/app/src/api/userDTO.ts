export interface AddTenantUserRequest {
  role: string;
  name: string;
  email: string;
  licenseNo: string;
  specialty: string;
}

export interface DeleteTenantUserRequest {
  userId: string;
}

export interface ChangePasswordRequest {
  newPassword: string;
}

export interface ForgotPasswordRequest {
  tenantId: string;
  email: string;
}

export interface GetDoctorSpecialtiesResponse {
  readonly id: string;
  readonly name: string;
}

export interface GetUserMetadataResponse {
  userId: string;
  metadata: { [key: string]: string | number };
  createdAt: number;
  updatedAt: number;
}

export interface GetTenantUserEmailInvitesResponse {
  id: string;
  tenantId: string;
  code: string;
  email: string;
  expiresAt: number;
  verifiedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface InviteTenantUserRequest {
  email: string;
}

export interface LoginRequest {
  tenantId: string;
  idToken: string;
}

export interface LoginResponse {
  readonly sessionToken: string;
}

export interface ResendTenantInvitationRequest {
  id: string;
}

export interface RegisterTenantUserRequest {
  tenantId: string;
  role: string;
  name: string;
  email: string;
  password: string;
  licenseNo: string;
  specialty: string;
  code: string;
}

export interface RemoveTenantUserEmailInviteRequest {
  id: string;
}

export interface UserResponse {
  readonly id: string;
  readonly tenantId: string;
  readonly role: string;
  readonly name: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email: string;
  readonly licenseNo: number;
  readonly specialty: string;
  readonly isEmailVerified: boolean;
  readonly isAccountDisabled: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface UpdateTenantUserRequest {
  id: string;
  role: string;
  name: string;
  licenseNo: string;
  specialty: string;
}

export interface UpdateUserMetadataRequest {
  metadata: { [key: string]: string | number | null };
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}
