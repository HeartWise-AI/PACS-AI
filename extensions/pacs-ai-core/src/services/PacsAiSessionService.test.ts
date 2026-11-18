import UserAuthenticationService from '@ohif/core/src/services/UserAuthenticationService/UserAuthenticationService';
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

  test('keeps the session token authoritative over a ?token= viewer URL', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const userAuthenticationService = new UserAuthenticationService();
    pacsAiSessionService.connectUserAuthenticationService(userAuthenticationService);
    localStorage.setItem('sessionToken', 'session-token');

    // What OHIF's Mode route does for /viewer?StudyInstanceUIDs=...&token=url-token
    // (updateAuthServiceAndCleanUrl in platform/app/src/routes/Mode, internal to
    // @ohif/app): it replaces the Authorization header implementation with one
    // that returns the URL token.
    userAuthenticationService.setServiceImplementation({
      getAuthorizationHeader: () => ({ Authorization: 'Bearer ' + 'url-token' }),
    });

    expect(userAuthenticationService.getAuthorizationHeader()).toEqual({
      Authorization: 'Bearer session-token',
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('passes the other implementations through and connects once', () => {
    const userAuthenticationService = new UserAuthenticationService();
    pacsAiSessionService.connectUserAuthenticationService(userAuthenticationService);
    pacsAiSessionService.connectUserAuthenticationService(userAuthenticationService);
    localStorage.setItem('sessionToken', 'token');

    const getUser = jest.fn(() => ({ name: 'user' }));
    userAuthenticationService.setServiceImplementation({ getUser });

    expect(userAuthenticationService.getUser()).toEqual({ name: 'user' });
    expect(userAuthenticationService.getAuthorizationHeader()).toEqual({
      Authorization: 'Bearer token',
    });
  });

  test('clears the session token', () => {
    localStorage.setItem('sessionToken', 'token');
    pacsAiSessionService.clearSession();
    expect(pacsAiSessionService.isAuthenticated()).toBe(false);
  });
});
