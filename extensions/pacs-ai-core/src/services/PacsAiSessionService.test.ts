import PacsAiSessionService, { pacsAiSessionService } from './PacsAiSessionService';

describe('pacsAiSessionService', () => {
  afterEach(() => localStorage.clear());

  test('registers as an OHIF service returning the shared instance', () => {
    expect(PacsAiSessionService.REGISTRATION.name).toBe('pacsAiSessionService');
    expect(PacsAiSessionService.REGISTRATION.create()).toBe(pacsAiSessionService);
  });

  test('builds the bearer header from the current session token', () => {
    expect(pacsAiSessionService.getAuthorizationHeader()).toBeUndefined();
    localStorage.setItem('sessionToken', 'token-1');
    expect(pacsAiSessionService.getAuthorizationHeader()).toEqual({
      Authorization: 'Bearer token-1',
    });
    localStorage.setItem('sessionToken', 'token-2');
    expect(pacsAiSessionService.getAuthorizationHeader()).toEqual({
      Authorization: 'Bearer token-2',
    });
  });

  test('connects OHIF userAuthenticationService to the session, read at request time', () => {
    const setServiceImplementation = jest.fn();
    pacsAiSessionService.connectUserAuthenticationService({ setServiceImplementation });

    const { getAuthorizationHeader } = setServiceImplementation.mock.calls[0][0];
    expect(getAuthorizationHeader()).toBeUndefined();
    localStorage.setItem('sessionToken', 'later-token');
    expect(getAuthorizationHeader()).toEqual({ Authorization: 'Bearer later-token' });
  });

  test('clears the session token', () => {
    localStorage.setItem('sessionToken', 'token');
    pacsAiSessionService.clearSession();
    expect(pacsAiSessionService.isAuthenticated()).toBe(false);
  });
});
