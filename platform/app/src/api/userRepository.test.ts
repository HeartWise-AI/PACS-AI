import Api from '../pacsAPIAxios';
import { UserAccessState } from './userDTO';
import userRepository from './userRepository';

jest.mock('../pacsAPIAxios');

const mockedApi = Api as jest.MockedFunction<typeof Api>;

describe('user repository access transitions', () => {
  const deleteRequest = jest.fn();
  const post = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.mockReturnValue({ delete: deleteRequest, post } as never);
  });

  test('preserves the existing delete error contract', async () => {
    const errorResponse = {
      success: false,
      message: 'Tenant user deletion was rejected.',
      errorCode: 'UNAUTHORIZED_ACCESS',
    };
    deleteRequest.mockRejectedValue({ response: { data: errorResponse } });

    await expect(userRepository.DeleteTenantUser({ userId: 'user-123' })).rejects.toEqual(
      errorResponse
    );
  });

  test('suspends the encoded user ID with an optional audit reason', async () => {
    const response = {
      success: true,
      message: 'Successfully updated tenant user access.',
      data: { userId: 'user/123', accessState: UserAccessState.SUSPENDED },
    };
    post.mockResolvedValue({ data: response });

    await expect(
      userRepository.SuspendTenantUser({ userId: 'user/123', reason: 'Repeated abuse' })
    ).resolves.toEqual(response);

    expect(post).toHaveBeenCalledWith('/v1/user/user%2F123/suspend', {
      reason: 'Repeated abuse',
    });
  });

  test('reactivates a user without requiring an audit reason', async () => {
    const response = {
      success: true,
      message: 'Successfully updated tenant user access.',
      data: { userId: 'user-123', accessState: UserAccessState.ACTIVE },
    };
    post.mockResolvedValue({ data: response });

    await expect(userRepository.ReactivateTenantUser({ userId: 'user-123' })).resolves.toEqual(
      response
    );

    expect(post).toHaveBeenCalledWith('/v1/user/user-123/reactivate', {
      reason: undefined,
    });
  });

  test('preserves backend conflict details for the UI to handle', async () => {
    const errorResponse = {
      success: false,
      message: 'Another account access change is already in progress.',
      errorCode: 'ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS',
    };
    post.mockRejectedValue({ response: { data: errorResponse } });

    await expect(userRepository.SuspendTenantUser({ userId: 'user-123' })).rejects.toEqual(
      errorResponse
    );
  });
});

describe('user repository login', () => {
  const post = jest.fn();
  const sensitiveValue = ['test', 'credential'].join('-');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.mockReturnValue({ post } as never);
  });

  test('posts credentials through the backend-owned login contract', async () => {
    const request = {
      tenantId: 'tenant-a',
      email: 'visitor@example.org',
      password: sensitiveValue,
      turnstileToken: 'single-use-proof',
    };
    const response = {
      success: true,
      message: 'Successfully signed-in tenant user.',
      data: { sessionToken: 'pacs-session-token' },
    };
    post.mockResolvedValue({ data: response });

    await expect(userRepository.Login(request)).resolves.toEqual(response);
    expect(post).toHaveBeenCalledWith('/v1/iam/login', request);
  });

  test('rejects with sanitized login metadata', async () => {
    post.mockRejectedValue({
      config: { data: JSON.stringify({ password: sensitiveValue }) },
      response: {
        status: 403,
        headers: {},
        data: {
          success: false,
          message: 'Additional verification is required.',
          errorCode: 'LOGIN_CHALLENGE_REQUIRED',
          data: { challengeRequired: true },
        },
      },
    });

    const failure = await userRepository.Login({
      tenantId: 'tenant-a',
      email: 'visitor@example.org',
      password: sensitiveValue,
    }).catch(error => error);

    expect(failure).toEqual({
      success: false,
      message: 'Additional verification is required.',
      errorCode: 'LOGIN_CHALLENGE_REQUIRED',
      status: 403,
      challengeRequired: true,
    });
    expect(failure).not.toHaveProperty('config');
    expect(JSON.stringify(failure)).not.toContain(sensitiveValue);
  });
});
