import type { RegisterTenantUserRequest } from '../../api/userDTO';

export interface RegistrationRequestValues {
  tenantId: string;
  invitationCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  licenseNo: string;
  specialty: string;
  turnstileToken: string;
}

export const createRegistrationRequest = ({
  tenantId,
  invitationCode,
  firstName,
  lastName,
  email,
  password,
  licenseNo,
  specialty,
  turnstileToken,
}: RegistrationRequestValues): RegisterTenantUserRequest => {
  const code = invitationCode?.trim();

  return {
    tenantId,
    name: `${firstName.trim()} ${lastName.trim()}`,
    email: email.trim().toLowerCase(),
    password,
    licenseNo: licenseNo.trim(),
    specialty,
    turnstileToken,
    ...(code ? { code } : {}),
  };
};
