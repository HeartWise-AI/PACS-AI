import { Error } from '../api/dto';
import {
  getPolicyAcceptanceReturnPath,
  getPolicyAcceptanceURL,
  handlePolicyAcceptanceRequiredError,
} from './policyAcceptanceSession';

describe('policy acceptance session handling', () => {
  test('redirects a blocked request while preserving its internal destination', () => {
    const redirect = jest.fn();

    expect(
      handlePolicyAcceptanceRequiredError(
        { response: { data: { errorCode: Error.POLICY_ACCEPTANCE_REQUIRED } } },
        {
          location: { pathname: '/viewer', search: '?study=1', hash: '#image' },
          redirect,
          storage: { getItem: () => 'session-token' },
        }
      )
    ).toBe(true);

    expect(redirect).toHaveBeenCalledWith(
      '/policies/accept?returnTo=%2Fviewer%3Fstudy%3D1%23image'
    );
  });

  test('does not create a redirect loop on the acceptance page', () => {
    const redirect = jest.fn();
    expect(
      handlePolicyAcceptanceRequiredError(
        { response: { data: { errorCode: Error.POLICY_ACCEPTANCE_REQUIRED } } },
        {
          location: { pathname: '/policies/accept', search: '', hash: '' },
          redirect,
          storage: { getItem: () => 'session-token' },
        }
      )
    ).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  test('ignores unrelated API failures', () => {
    const redirect = jest.fn();
    expect(
      handlePolicyAcceptanceRequiredError(
        { response: { data: { errorCode: Error.UNAUTHORIZED_ACCESS } } },
        {
          location: { pathname: '/', search: '', hash: '' },
          redirect,
          storage: { getItem: () => 'session-token' },
        }
      )
    ).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  test('does not redirect an unauthenticated registration failure', () => {
    const redirect = jest.fn();
    expect(
      handlePolicyAcceptanceRequiredError(
        { response: { data: { errorCode: Error.POLICY_ACCEPTANCE_REQUIRED } } },
        {
          location: { pathname: '/register', search: '?t=demo', hash: '' },
          redirect,
          storage: { getItem: () => null },
        }
      )
    ).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  test('rejects external and recursive return paths', () => {
    expect(getPolicyAcceptanceURL('https://evil.example')).toBe('/policies/accept?returnTo=%2F');
    expect(getPolicyAcceptanceReturnPath('?returnTo=%2F%2Fevil.example')).toBe('/');
    expect(getPolicyAcceptanceReturnPath('?returnTo=%2Fpolicies%2Faccept%3Fretry%3D1')).toBe('/');
    expect(getPolicyAcceptanceReturnPath('?returnTo=%2Fviewer%3Fstudy%3D1')).toBe(
      '/viewer?study=1'
    );
  });
});
