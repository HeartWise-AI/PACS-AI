import Api from '../pacsAPIAxios';
import { UserAccessState } from './userDTO';
import userRepository from './userRepository';

jest.mock('../pacsAPIAxios');

const mockedApi = Api as jest.MockedFunction<typeof Api>;

describe('user repository access transitions', () => {
  const post = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.mockReturnValue({ post } as never);
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
