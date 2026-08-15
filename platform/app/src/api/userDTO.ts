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

export interface ChangeTenantUserAccessRequest {
  userId: string;
  reason?: string;
}

export interface ChangeTenantUserAccessResponse {
  readonly userId: string;
  readonly accessState: UserAccessState;
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
  email: string;
  password: string;
  turnstileToken?: string;
}

export interface LoginResponse {
  readonly sessionToken: string;
}

export interface ResendTenantInvitationRequest {
  id: string;
}

export interface RegisterTenantUserRequest {
  tenantId: string;
  name: string;
  email: string;
  password: string;
  licenseNo: string;
  specialty: string;
  turnstileToken: string;
  policyAcceptances: PolicyAcceptanceInput[];
  code?: string;
}

export type PolicyKey = 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY';

export interface PolicyAcceptanceInput {
  policyKey: PolicyKey;
  version: string;
}

export interface PolicyDefinition {
  readonly policyKey: PolicyKey;
  readonly version: string;
  readonly title: string;
  readonly url: string;
  readonly effectiveAt: string;
  readonly acceptanceAction: 'AGREE' | 'ACKNOWLEDGE';
  readonly required: boolean;
}

export interface PolicyStatusItem extends PolicyDefinition {
  readonly accepted: boolean;
  readonly acceptedAt?: number;
}

export interface PolicyStatus {
  readonly policies: PolicyStatusItem[];
  readonly acceptanceRequired: boolean;
  readonly enforcementActive: boolean;
}

export interface AcceptPoliciesRequest {
  acceptances: PolicyAcceptanceInput[];
}

export interface RemoveTenantUserEmailInviteRequest {
  id: string;
}

export interface UserResponse {
  readonly id: string;
  readonly tenantId: string;
  readonly role: UserRole;
  readonly accessState: UserAccessState;
  readonly name: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email: string;
  readonly licenseNo: string;
  readonly specialty: string;
  readonly isEmailVerified: boolean;
  readonly isAccountDisabled: boolean;
  readonly isConsentSigned: boolean;
  readonly isAdminCreated: boolean;
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

export interface VerifyEmailRequest {
  tenantId: string;
  email: string;
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

export enum UserAccessState {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}
