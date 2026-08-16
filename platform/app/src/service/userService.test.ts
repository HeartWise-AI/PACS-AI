import tenantRepository from '../api/tenantRepository';
import userRepository from '../api/userRepository';
import type { UserResponse } from '../api/userDTO';
import { navigateAfterAuth } from './userService';

jest.mock('../api/tenantRepository', () => ({
  __esModule: true,
  default: {
    GetTenantInfo: jest.fn(),
  },
}));

jest.mock('../api/userRepository', () => ({
  __esModule: true,
  default: {
    GetPolicyStatus: jest.fn(),
  },
}));

const getTenantInfo = tenantRepository.GetTenantInfo as jest.Mock;
const getPolicyStatus = userRepository.GetPolicyStatus as jest.Mock;

const createUser = (overrides: Partial<UserResponse> = {}) =>
  ({
    isEmailVerified: true,
    isAdminCreated: false,
    isConsentSigned: true,
    ...overrides,
  }) as UserResponse;

describe('navigateAfterAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPolicyStatus.mockResolvedValue({ data: { acceptanceRequired: false } });
  });

  test('replaces the login history entry with the worklist', async () => {
    const navigate = jest.fn();

    await navigateAfterAuth(navigate, createUser());

    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(getTenantInfo).not.toHaveBeenCalled();
  });

  test('replaces the login history entry with the password setup route', async () => {
    const navigate = jest.fn();

    await navigateAfterAuth(navigate, createUser({ isEmailVerified: false, isAdminCreated: true }));

    expect(navigate).toHaveBeenCalledWith('/change-password', {
      replace: true,
    });
  });

  test('continues to replace the login history entry when consent is required', async () => {
    const navigate = jest.fn();
    getTenantInfo.mockResolvedValue({
      data: { onboardingEnableConsent: true },
    });

    await navigateAfterAuth(navigate, createUser({ isConsentSigned: false }));

    expect(navigate).toHaveBeenCalledWith('/user/consent', { replace: true });
  });

  test('routes missing acceptance to the policy page before consent or worklist access', async () => {
    const navigate = jest.fn();
    getPolicyStatus.mockResolvedValue({ data: { acceptanceRequired: true } });

    await navigateAfterAuth(navigate, createUser({ isConsentSigned: false }), '/viewer?study=1');

    expect(navigate).toHaveBeenCalledWith('/policies/accept?returnTo=%2Fviewer%3Fstudy%3D1', {
      replace: true,
    });
    expect(getTenantInfo).not.toHaveBeenCalled();
  });

  test('fails closed on the retryable policy page when status is unavailable', async () => {
    const navigate = jest.fn();
    getPolicyStatus.mockRejectedValue(new Error('unavailable'));

    await navigateAfterAuth(navigate, createUser());

    expect(navigate).toHaveBeenCalledWith('/policies/accept?returnTo=%2F', {
      replace: true,
    });
  });
});
