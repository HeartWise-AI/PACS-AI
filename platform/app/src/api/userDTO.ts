export interface LoginRequest {
  tenantId: string;
  idToken: string;
}

export interface LoginResponse {
  sessionToken: string
}

export interface UserResponse {
  id: string
  tenantId: string
  role: string
  name: string
  email: string
  licenseNo: number
  specialty: string
  isEmailVerified: boolean
  isAccountDisabled: boolean
  createdAt: number
  updatedAt: number
}
