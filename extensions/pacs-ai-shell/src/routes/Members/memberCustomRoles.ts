import { UserRole } from '@pacs-ai/extension-core/src/api/userDTO';

export interface CustomRoleSummary {
  id: string;
  name: string;
}

/** Name of the member's custom role, or null when none (or unknown/deleted). */
export function getCustomRoleName(
  roles: CustomRoleSummary[],
  customRoleId?: string | null
): string | null {
  if (!customRoleId) {
    return null;
  }
  return roles.find(role => role.id === customRoleId)?.name ?? null;
}

/** Only OWNER/ADMIN assign custom roles, and only to base USER accounts. */
export function canAssignCustomRole(isAdminActor: boolean, targetRole?: string | null): boolean {
  return isAdminActor && targetRole === UserRole.USER;
}

/**
 * The custom-role id to send after saving a member, or null when nothing
 * changed. A member promoted to ADMIN loses the custom role on the server.
 */
export function getCustomRoleChange(
  originalId: string | null | undefined,
  nextId: string | null | undefined,
  nextRole: string
): string | null {
  if (nextRole !== UserRole.USER) {
    return null;
  }
  const before = originalId ?? '';
  const after = nextId ?? '';
  return before === after ? null : after;
}
