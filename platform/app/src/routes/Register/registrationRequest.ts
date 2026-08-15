import type { RegisterTenantUserRequest } from '../../api/userDTO';
import type { PolicyAcceptanceInput } from '../../api/userDTO';

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
  policyAcceptances: PolicyAcceptanceInput[];
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
  policyAcceptances,
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
    policyAcceptances,
    ...(code ? { code } : {}),
  };
};
