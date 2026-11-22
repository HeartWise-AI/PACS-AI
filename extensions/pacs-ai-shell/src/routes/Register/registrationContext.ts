export interface RegistrationContext {
  tenantId: string;
  invitationCode: string;
  invitedEmail: string;
  hasTenantInLink: boolean;
  canonicalSearch: string;
}

export const resolveRegistrationContext = (
  search: string,
  storedTenantId?: string | null,
  defaultTenantId?: string | null
): RegistrationContext => {
  const params = new URLSearchParams(search);
  const tenantIdFromLink = (params.get('t') || '').trim();
  const tenantId =
    tenantIdFromLink || (storedTenantId || '').trim() || (defaultTenantId || '').trim();
  const invitationCode = (params.get('code') || '').trim();
  const invitedEmail = (params.get('email') || '').trim().toLowerCase();

  if (tenantId) {
    params.set('t', tenantId);
  }

  const canonicalQuery = params.toString();

  return {
    tenantId,
    invitationCode,
    invitedEmail,
    hasTenantInLink: Boolean(tenantIdFromLink),
    canonicalSearch: canonicalQuery ? `?${canonicalQuery}` : '',
  };
};

export const getRegistrationContextError = (
  context: RegistrationContext
): 'Registration link is missing tenant' | null => {
  if (!context.tenantId || (context.invitationCode && !context.hasTenantInLink)) {
    return 'Registration link is missing tenant';
  }

  return null;
};
