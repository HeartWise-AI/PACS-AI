import { UserAccessState, UserRole } from '@pacs-ai/extension-core/src/api/userDTO';

export interface MemberAccessIdentity {
  id: string;
  role: string;
  accessState?: string;
  /** A USER whose custom role grants members.manage may manage other USERs. */
  canManageMembers?: boolean;
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

  if (actor.role === UserRole.USER && actor.canManageMembers && target.role === UserRole.USER) {
    return { allowed: true, restriction: 'ALLOWED' };
  }

  return denied('INSUFFICIENT_ROLE');
};

/**
 * Whether the actor may edit or delete the target account at all. Mirrors the
 * gateway rule: OWNER is absolute (no one changes, demotes, suspends or removes
 * the OWNER, and no one changes their own account here); OWNER manages ADMIN
 * and USER; ADMIN, and a USER whose custom role grants members.manage, manage
 * USER accounts only.
 */
export const canManageMemberAccount = (
  actor?: MemberAccessIdentity | null,
  target?: MemberAccessIdentity | null
): boolean => {
  if (!actor?.id || !target?.id) {
    return false;
  }
  if (actor.accessState !== UserAccessState.ACTIVE || actor.id === target.id) {
    return false;
  }
  if (target.role === UserRole.OWNER) {
    return false;
  }
  if (actor.role === UserRole.OWNER) {
    return true;
  }
  if (actor.role === UserRole.ADMIN) {
    return target.role === UserRole.USER;
  }
  return actor.role === UserRole.USER && Boolean(actor.canManageMembers) && target.role === UserRole.USER;
};

/** Roles the actor may assign: only the OWNER grants ADMIN; nobody grants OWNER here. */
export const assignableMemberRoles = (actorRole?: string): UserRole[] =>
  actorRole === UserRole.OWNER ? [UserRole.ADMIN, UserRole.USER] : [UserRole.USER];
