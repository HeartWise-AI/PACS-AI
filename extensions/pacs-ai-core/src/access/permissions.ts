import { UserRole, type UserAccessResponse } from '../api/userDTO';

/**
 * Permission ids shared with the api-pacs gateway (`/v1/user/me/access`).
 * OWNER and ADMIN hold every permission and every model. A USER holds the
 * baseline (use models, vote) plus whatever their custom role grants.
 */
export const Permission = {
  MODELS_USE: 'models.use',
  FEEDBACK_VOTE: 'feedback.vote',
  RESULTS_VIEW_ALL: 'results.view_all',
  FEEDBACK_VIEW: 'feedback.view',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_MANAGE: 'members.manage',
  PROCESSING_MANAGE: 'processing.manage',
  MODELS_MANAGE: 'models.manage',
  DICOM_MANAGE: 'dicom.manage',
  LOGS_VIEW: 'logs.view',
  WORKSPACE_MANAGE: 'workspace.manage',
} as const;

export type PermissionId = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: readonly PermissionId[] = Object.values(Permission);

export const BASELINE_PERMISSIONS: readonly PermissionId[] = [
  Permission.MODELS_USE,
  Permission.FEEDBACK_VOTE,
];

/** Permissions a custom role can add on top of the baseline. */
export const GRANTABLE_PERMISSIONS: readonly PermissionId[] = ALL_PERMISSIONS.filter(
  permission => !BASELINE_PERMISSIONS.includes(permission)
);

/** Permissions that open a page of the admin console. */
export const ADMIN_AREA_PERMISSIONS: readonly PermissionId[] = [
  Permission.MEMBERS_INVITE,
  Permission.MEMBERS_MANAGE,
  Permission.LOGS_VIEW,
  Permission.WORKSPACE_MANAGE,
  Permission.DICOM_MANAGE,
  Permission.MODELS_MANAGE,
  Permission.PROCESSING_MANAGE,
  Permission.FEEDBACK_VIEW,
];

export const WORKSPACE_SETTINGS_PERMISSIONS: readonly PermissionId[] = [
  Permission.WORKSPACE_MANAGE,
  Permission.DICOM_MANAGE,
  Permission.MODELS_MANAGE,
  Permission.PROCESSING_MANAGE,
  Permission.FEEDBACK_VIEW,
];

export interface UserAccess {
  readonly role: UserRole;
  /** OWNER or ADMIN: every permission, every model, manages custom roles. */
  readonly isAdmin: boolean;
  readonly permissions: ReadonlySet<string>;
  readonly allModels: boolean;
  readonly modelIds: ReadonlySet<string>;
  readonly customRole: { readonly id: string; readonly name: string } | null;
}

const ADMIN_ROLES: ReadonlySet<string> = new Set([UserRole.ADMIN, UserRole.OWNER]);

export const isAdminRole = (role?: string | null): boolean => role != null && ADMIN_ROLES.has(role);

const toRole = (role: unknown): UserRole => {
  if (role === UserRole.OWNER || role === UserRole.ADMIN) {
    return role;
  }
  return UserRole.USER;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];

/** Access implied by the base role alone (used when the gateway has no access endpoint). */
export function accessForRole(role?: string | null): UserAccess {
  const isAdmin = isAdminRole(role);
  return {
    role: toRole(role),
    isAdmin,
    permissions: new Set<string>(isAdmin ? ALL_PERMISSIONS : BASELINE_PERMISSIONS),
    allModels: true,
    modelIds: new Set(),
    customRole: null,
  };
}

/** Normalizes the gateway response; admins always get everything. */
export function normalizeUserAccess(
  response: Partial<UserAccessResponse> | null | undefined
): UserAccess {
  const role = toRole(response?.role);
  if (isAdminRole(role)) {
    return accessForRole(role);
  }
  const permissions = new Set<string>([
    ...BASELINE_PERMISSIONS,
    ...stringList(response?.permissions),
  ]);
  const customRole =
    response?.customRole && typeof response.customRole.id === 'string' && response.customRole.id
      ? { id: response.customRole.id, name: String(response.customRole.name ?? '') }
      : null;
  return {
    role,
    isAdmin: false,
    permissions,
    allModels: response?.allModels !== false,
    modelIds: new Set(stringList(response?.modelIds)),
    customRole,
  };
}

export function can(access: UserAccess | null | undefined, permission: string): boolean {
  if (!access) {
    return false;
  }
  return access.isAdmin || access.permissions.has(permission);
}

export function canAny(
  access: UserAccess | null | undefined,
  permissions: readonly string[]
): boolean {
  return permissions.some(permission => can(access, permission));
}

/** Model ids are the model-info `modelId` (e.g. `DeepRV_CLIP`). */
export function canUseModel(
  access: UserAccess | null | undefined,
  modelId?: string | null
): boolean {
  if (!access || !can(access, Permission.MODELS_USE)) {
    return false;
  }
  if (access.isAdmin || access.allModels) {
    return true;
  }
  return modelId != null && access.modelIds.has(modelId);
}

export function hasAdminArea(access: UserAccess | null | undefined): boolean {
  return Boolean(access?.isAdmin) || canAny(access, ADMIN_AREA_PERMISSIONS);
}

/** First admin page the user may open, for the "Admin Console" link. */
export function getAdminLandingPath(access: UserAccess | null | undefined): string | null {
  if (!hasAdminArea(access)) {
    return null;
  }
  if (canAny(access, [Permission.MEMBERS_INVITE, Permission.MEMBERS_MANAGE])) {
    return '/admin/members';
  }
  if (access?.isAdmin || canAny(access, WORKSPACE_SETTINGS_PERMISSIONS)) {
    return '/admin/workspace-settings';
  }
  if (can(access, Permission.LOGS_VIEW)) {
    return '/admin/kibana-logs';
  }
  return null;
}
