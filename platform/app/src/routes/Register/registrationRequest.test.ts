import { createRegistrationRequest } from './registrationRequest';

describe('createRegistrationRequest', () => {
  it('sends the Turnstile proof without a client-selected role', () => {
    const request = createRegistrationRequest({
      tenantId: 'tenant-from-link',
      invitationCode: ' invite-code ',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      email: ' ADA@EXAMPLE.COM ',
      password: 'Strong!Password',
      licenseNo: ' 12345 ',
      specialty: 'cardiology',
      turnstileToken: 'turnstile-proof',
    });

    expect(request).toEqual({
      tenantId: 'tenant-from-link',
      code: 'invite-code',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Strong!Password',
      licenseNo: '12345',
      specialty: 'cardiology',
      turnstileToken: 'turnstile-proof',
    });
    expect(request).not.toHaveProperty('role');
  });

  it('preserves tenant-aware registration without inventing an invitation code', () => {
    const request = createRegistrationRequest({
      tenantId: 'tenant-from-session',
      invitationCode: '   ',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      password: 'Strong!Password',
      licenseNo: '67890',
      specialty: 'radiology',
      turnstileToken: 'turnstile-proof',
    });

    expect(request.tenantId).toBe('tenant-from-session');
    expect(request).not.toHaveProperty('code');
  });
});
