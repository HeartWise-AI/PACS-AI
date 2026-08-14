import tenantRepository from '../api/tenantRepository';
import type { UserResponse } from '../api/userDTO';
import { navigateAfterAuth } from './userService';

jest.mock('../api/tenantRepository', () => ({
  __esModule: true,
  default: {
    GetTenantInfo: jest.fn(),
  },
}));

const getTenantInfo = tenantRepository.GetTenantInfo as jest.Mock;

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
  });

  test('replaces the login history entry with the worklist', async () => {
    const navigate = jest.fn();

    await navigateAfterAuth(navigate, createUser());

    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(getTenantInfo).not.toHaveBeenCalled();
  });

  test('replaces the login history entry with the password setup route', async () => {
    const navigate = jest.fn();

    await navigateAfterAuth(
      navigate,
      createUser({ isEmailVerified: false, isAdminCreated: true })
    );

    expect(navigate).toHaveBeenCalledWith('/change-password', { replace: true });
  });

  test('continues to replace the login history entry when consent is required', async () => {
    const navigate = jest.fn();
    getTenantInfo.mockResolvedValue({ data: { onboardingEnableConsent: true } });

    await navigateAfterAuth(navigate, createUser({ isConsentSigned: false }));

    expect(navigate).toHaveBeenCalledWith('/user/consent', { replace: true });
  });
});
