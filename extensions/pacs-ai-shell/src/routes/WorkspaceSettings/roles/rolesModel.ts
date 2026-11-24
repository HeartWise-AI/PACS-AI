import {
  GRANTABLE_PERMISSIONS,
  Permission,
  type PermissionId,
} from '@pacs-ai/extension-core/src/access/permissions';
import type {
  CustomRoleResponse,
  UpsertCustomRoleRequest,
} from '@pacs-ai/extension-core/src/api/userDTO';

/** English strings are i18n keys of the `Roles` namespace. */
export interface PermissionInfo {
  id: PermissionId;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: PermissionInfo[];
}

export const BASELINE_PERMISSION_INFO: PermissionInfo[] = [
  {
    id: Permission.MODELS_USE,
    label: 'Use models',
    description: 'Run models on studies and read their results and reports.',
  },
  {
    id: Permission.FEEDBACK_VOTE,
    label: 'Rate reports',
    description: 'Give a thumbs up or down on AI reports.',
  },
];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'results',
    label: 'Results and feedback',
    permissions: [
      {
        id: Permission.RESULTS_VIEW_ALL,
        label: 'See everyone’s results',
        description: 'Open the AI Predictions page for every user, and export it.',
      },
      {
        id: Permission.FEEDBACK_VIEW,
        label: 'View model feedback',
        description: 'Open the Model Feedback dashboard with every reader’s votes.',
      },
    ],
  },
  {
    id: 'members',
    label: 'Members',
    permissions: [
      {
        id: Permission.MEMBERS_INVITE,
        label: 'Invite users',
        description: 'Send, resend and cancel invitations, and add members.',
      },
      {
        id: Permission.MEMBERS_MANAGE,
        label: 'Manage members',
        description: 'Edit, suspend, reactivate and remove members without admin rights.',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Processing and models',
    permissions: [
      {
        id: Permission.PROCESSING_MANAGE,
        label: 'Manage processing',
        description: 'Reprocess studies and manage ingestion jobs.',
      },
      {
        id: Permission.MODELS_MANAGE,
        label: 'Manage models',
        description: 'Add, deploy, start, stop and move models between GPUs.',
      },
      {
        id: Permission.DICOM_MANAGE,
        label: 'Manage DICOM connections',
        description: 'Test, edit and remove PACS modalities.',
      },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    permissions: [
      {
        id: Permission.WORKSPACE_MANAGE,
        label: 'Manage workspace settings',
        description: 'Change onboarding, registration and consent settings.',
      },
      {
        id: Permission.LOGS_VIEW,
        label: 'View logs',
        description: 'Open the Kibana logs page.',
      },
    ],
  },
];

const PERMISSION_INFO_BY_ID = new Map<string, PermissionInfo>(
  [...BASELINE_PERMISSION_INFO, ...PERMISSION_GROUPS.flatMap(group => group.permissions)].map(
    info => [info.id, info]
  )
);

export function getPermissionInfo(id: string): PermissionInfo | undefined {
  return PERMISSION_INFO_BY_ID.get(id);
}

export const ROLE_NAME_MAX = 64;
export const ROLE_DESCRIPTION_MAX = 280;

export interface RoleFormState {
  id: string | null;
  name: string;
  description: string;
  permissions: string[];
  allModels: boolean;
  modelIds: string[];
}

export const EMPTY_ROLE_FORM: RoleFormState = {
  id: null,
  name: '',
  description: '',
  permissions: [],
  allModels: true,
  modelIds: [],
};

const GRANTABLE = new Set<string>(GRANTABLE_PERMISSIONS);

export function roleToForm(role: CustomRoleResponse): RoleFormState {
  return {
    id: role.id,
    name: role.name ?? '',
    description: role.description ?? '',
    permissions: (role.permissions ?? []).filter(permission => GRANTABLE.has(permission)),
    allModels: role.allModels !== false,
    modelIds: [...(role.modelIds ?? [])],
  };
}

export function togglePermission(form: RoleFormState, permission: string): RoleFormState {
  const has = form.permissions.includes(permission);
  return {
    ...form,
    permissions: has
      ? form.permissions.filter(item => item !== permission)
      : [...form.permissions, permission],
  };
}

export function toggleModel(form: RoleFormState, modelId: string): RoleFormState {
  const has = form.modelIds.includes(modelId);
  return {
    ...form,
    modelIds: has ? form.modelIds.filter(item => item !== modelId) : [...form.modelIds, modelId],
  };
}

export type RoleFormError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'nameTaken'
  | 'descriptionTooLong'
  | 'modelsRequired';

export function validateRoleForm(
  form: RoleFormState,
  existingRoles: Pick<CustomRoleResponse, 'id' | 'name'>[]
): RoleFormError[] {
  const errors: RoleFormError[] = [];
  const name = form.name.trim();
  if (!name) {
    errors.push('nameRequired');
  } else if (name.length > ROLE_NAME_MAX) {
    errors.push('nameTooLong');
  } else if (
    existingRoles.some(
      role => role.id !== form.id && role.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    errors.push('nameTaken');
  }
  if (form.description.trim().length > ROLE_DESCRIPTION_MAX) {
    errors.push('descriptionTooLong');
  }
  if (!form.allModels && form.modelIds.length === 0) {
    errors.push('modelsRequired');
  }
  return errors;
}

export const ROLE_FORM_ERROR_MESSAGES: Record<RoleFormError, string> = {
  nameRequired: 'Enter a role name.',
  nameTooLong: 'Use 64 characters or fewer for the name.',
  nameTaken: 'Another role already has this name.',
  descriptionTooLong: 'Use 280 characters or fewer for the description.',
  modelsRequired: 'Pick at least one model, or allow all models.',
};

/** Request body in the gateway's order; permissions follow the catalog order. */
export function serializeRoleForm(form: RoleFormState): UpsertCustomRoleRequest {
  const permissions = GRANTABLE_PERMISSIONS.filter(permission =>
    form.permissions.includes(permission)
  );
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    permissions,
    allModels: form.allModels,
    modelIds: form.allModels ? [] : [...new Set(form.modelIds)].sort(),
  };
}

/** Short summary for the roles table, e.g. "3 of 9 permissions". */
export function countGrantedPermissions(role: Pick<CustomRoleResponse, 'permissions'>): number {
  return (role.permissions ?? []).filter(permission => GRANTABLE.has(permission)).length;
}

export function sortRoles<T extends Pick<CustomRoleResponse, 'name'>>(roles: T[]): T[] {
  return [...roles].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}
