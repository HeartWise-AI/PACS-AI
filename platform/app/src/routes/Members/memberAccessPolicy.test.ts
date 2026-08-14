import { UserAccessState, UserRole } from '../../api/userDTO';
import { getMemberAccessEligibility, type MemberAccessIdentity } from './memberAccessPolicy';

const identity = (
  id: string,
  role: UserRole,
  accessState: UserAccessState = UserAccessState.ACTIVE
): MemberAccessIdentity => ({ id, role, accessState });

describe('member access action eligibility', () => {
  test.each([
    [identity('owner', UserRole.OWNER), identity('admin', UserRole.ADMIN)],
    [identity('owner', UserRole.OWNER), identity('user', UserRole.USER)],
    [identity('admin', UserRole.ADMIN), identity('user', UserRole.USER)],
    [identity('admin', UserRole.ADMIN), identity('user', UserRole.USER, UserAccessState.SUSPENDED)],
  ])('allows the supported actor and target hierarchy', (actor, target) => {
    expect(getMemberAccessEligibility(actor, target)).toEqual({
      allowed: true,
      restriction: 'ALLOWED',
    });
  });

  test.each([
    [identity('same', UserRole.OWNER), identity('same', UserRole.USER), 'SELF_MANAGEMENT'],
    [identity('owner-1', UserRole.OWNER), identity('owner-2', UserRole.OWNER), 'OWNER_TARGET'],
    [identity('admin', UserRole.ADMIN), identity('owner', UserRole.OWNER), 'OWNER_TARGET'],
    [identity('admin-1', UserRole.ADMIN), identity('admin-2', UserRole.ADMIN), 'INSUFFICIENT_ROLE'],
    [identity('user-1', UserRole.USER), identity('user-2', UserRole.USER), 'INSUFFICIENT_ROLE'],
    [
      identity('admin', UserRole.ADMIN, UserAccessState.SUSPENDED),
      identity('user', UserRole.USER),
      'ACTOR_NOT_ACTIVE',
    ],
  ])('denies unsafe or unauthorized management', (actor, target, restriction) => {
    expect(getMemberAccessEligibility(actor, target)).toEqual({ allowed: false, restriction });
  });

  test('denies missing identities and unknown target access states safely', () => {
    expect(getMemberAccessEligibility(null, identity('user', UserRole.USER))).toMatchObject({
      allowed: false,
      restriction: 'IDENTITY_UNAVAILABLE',
    });
    expect(
      getMemberAccessEligibility(identity('owner', UserRole.OWNER), {
        id: 'user',
        role: UserRole.USER,
      })
    ).toMatchObject({ allowed: false, restriction: 'UNKNOWN_TARGET_STATE' });
  });
});
