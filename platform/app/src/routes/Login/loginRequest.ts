import type { LoginRequest } from '../../api/userDTO';

interface CreateLoginRequestInput {
  tenantId: string;
  email: string;
  password: string;
  turnstileToken?: string;
}

export const createLoginRequest = ({
  tenantId,
  email,
  password,
  turnstileToken,
}: CreateLoginRequestInput): LoginRequest => ({
  tenantId: tenantId.trim(),
  email: email.trim().toLowerCase(),
  password,
  ...(turnstileToken ? { turnstileToken } : {}),
});
