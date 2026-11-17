import { getRegistrationContextError, resolveRegistrationContext } from './registrationContext';

describe('resolveRegistrationContext', () => {
  it('keeps the tenant, code, and email from an invitation link together', () => {
    const context = resolveRegistrationContext(
      '?t=tenant-from-link&code=invite-code&email=Invited%40Example.com',
      'stored-tenant',
      'default-tenant'
    );

    expect(context).toEqual({
      tenantId: 'tenant-from-link',
      invitationCode: 'invite-code',
      invitedEmail: 'invited@example.com',
      hasTenantInLink: true,
      canonicalSearch: '?t=tenant-from-link&code=invite-code&email=Invited%40Example.com',
    });
    expect(getRegistrationContextError(context)).toBeNull();
  });

  it('uses the stored tenant before the public default and makes it explicit in navigation', () => {
    const storedContext = resolveRegistrationContext('?source=login', 'stored-tenant', 'default');
    const defaultContext = resolveRegistrationContext('', null, 'default-tenant');

    expect(storedContext.tenantId).toBe('stored-tenant');
    expect(storedContext.canonicalSearch).toBe('?source=login&t=stored-tenant');
    expect(defaultContext.tenantId).toBe('default-tenant');
    expect(defaultContext.canonicalSearch).toBe('?t=default-tenant');
  });

  it('rejects an invitation code that is not bound to a tenant in the link', () => {
    const context = resolveRegistrationContext('?code=invite-code', 'stored-tenant', 'default');

    expect(context.tenantId).toBe('stored-tenant');
    expect(context.hasTenantInLink).toBe(false);
    expect(getRegistrationContextError(context)).toBe('Registration link is missing tenant');
  });

  it('reports a missing tenant when no link, session, or public default provides one', () => {
    const context = resolveRegistrationContext('', null, null);

    expect(context.canonicalSearch).toBe('');
    expect(getRegistrationContextError(context)).toBe('Registration link is missing tenant');
  });
});
