import { UserAccessState } from '../../api/userDTO';
import {
  ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS,
  executeMemberAccessTransition,
} from './memberAccessTransition';

const response = (accessState: UserAccessState) => ({
  success: true,
  message: 'Updated access.',
  data: { userId: 'target', accessState },
});

const createRepository = () => ({
  SuspendTenantUser: jest.fn(),
  ReactivateTenantUser: jest.fn(),
});

describe('member access transition execution', () => {
  test.each([
    ['suspend', 'SuspendTenantUser', UserAccessState.SUSPENDED],
    ['reactivate', 'ReactivateTenantUser', UserAccessState.ACTIVE],
  ] as const)(
    'executes %s and refreshes authoritative member state',
    async (action, method, state) => {
      const repository = createRepository();
      repository[method].mockResolvedValue(response(state));
      const refreshMembers = jest.fn().mockResolvedValue(undefined);

      await expect(
        executeMemberAccessTransition({
          action,
          userId: 'target',
          reason: '  Audit reason  ',
          repository,
          refreshMembers,
        })
      ).resolves.toEqual(response(state));

      expect(repository[method]).toHaveBeenCalledWith({
        userId: 'target',
        reason: 'Audit reason',
      });
      expect(refreshMembers).toHaveBeenCalledTimes(1);
    }
  );

  test('refreshes after a transition conflict before preserving the backend error', async () => {
    const repository = createRepository();
    const conflict = {
      errorCode: ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS,
      message: 'Another account access change is already in progress.',
    };
    repository.SuspendTenantUser.mockRejectedValue(conflict);
    const refreshMembers = jest.fn().mockResolvedValue(undefined);

    await expect(
      executeMemberAccessTransition({
        action: 'suspend',
        userId: 'target',
        repository,
        refreshMembers,
      })
    ).rejects.toBe(conflict);
    expect(refreshMembers).toHaveBeenCalledTimes(1);
  });

  test('does not refresh after a rejected request that made no transition', async () => {
    const repository = createRepository();
    repository.ReactivateTenantUser.mockRejectedValue({
      errorCode: 'FORBIDDEN_ACCESS',
      message: 'Forbidden access.',
    });
    const refreshMembers = jest.fn().mockResolvedValue(undefined);

    await expect(
      executeMemberAccessTransition({
        action: 'reactivate',
        userId: 'target',
        repository,
        refreshMembers,
      })
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN_ACCESS' });
    expect(refreshMembers).not.toHaveBeenCalled();
  });
});
