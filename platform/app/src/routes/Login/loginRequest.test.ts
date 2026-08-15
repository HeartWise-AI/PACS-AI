import { createLoginRequest } from './loginRequest';

describe('createLoginRequest', () => {
  const sensitiveValue = ['test', 'credential'].join('-');

  it('normalizes the account identifier without adding an unnecessary challenge proof', () => {
    expect(
      createLoginRequest({
        tenantId: ' tenant-a ',
        email: ' Visitor@Example.ORG ',
        password: sensitiveValue,
      })
    ).toEqual({
      tenantId: 'tenant-a',
      email: 'visitor@example.org',
      password: sensitiveValue,
    });
  });

  it('includes a fresh proof only for a challenged submission', () => {
    expect(
      createLoginRequest({
        tenantId: 'tenant-a',
        email: 'visitor@example.org',
        password: sensitiveValue,
        turnstileToken: 'single-use-proof',
      })
    ).toEqual({
      tenantId: 'tenant-a',
      email: 'visitor@example.org',
      password: sensitiveValue,
      turnstileToken: 'single-use-proof',
    });
  });
});
