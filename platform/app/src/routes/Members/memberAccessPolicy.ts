import { UserAccessState, UserRole } from '../../api/userDTO';

export interface MemberAccessIdentity {
  id: string;
  role: string;
  accessState?: string;
}

export type MemberAccessRestriction =
  | 'ALLOWED'
  | 'IDENTITY_UNAVAILABLE'
  | 'ACTOR_NOT_ACTIVE'
  | 'SELF_MANAGEMENT'
  | 'OWNER_TARGET'
  | 'UNKNOWN_TARGET_STATE'
  | 'INSUFFICIENT_ROLE';

export interface MemberAccessEligibility {
  allowed: boolean;
  restriction: MemberAccessRestriction;
}

const denied = (restriction: Exclude<MemberAccessRestriction, 'ALLOWED'>) => ({
  allowed: false,
  restriction,
});

export const getMemberAccessEligibility = (
  actor?: MemberAccessIdentity | null,
  target?: MemberAccessIdentity | null
): MemberAccessEligibility => {
  if (!actor?.id || !target?.id) {
    return denied('IDENTITY_UNAVAILABLE');
  }

  if (actor.accessState !== UserAccessState.ACTIVE) {
    return denied('ACTOR_NOT_ACTIVE');
  }

  if (actor.id === target.id) {
    return denied('SELF_MANAGEMENT');
  }

  if (target.role === UserRole.OWNER) {
    return denied('OWNER_TARGET');
  }

  if (
    target.accessState !== UserAccessState.ACTIVE &&
    target.accessState !== UserAccessState.SUSPENDED
  ) {
    return denied('UNKNOWN_TARGET_STATE');
  }

  if (actor.role === UserRole.OWNER) {
    return { allowed: true, restriction: 'ALLOWED' };
  }

  if (actor.role === UserRole.ADMIN && target.role === UserRole.USER) {
    return { allowed: true, restriction: 'ALLOWED' };
  }

  return denied('INSUFFICIENT_ROLE');
};
