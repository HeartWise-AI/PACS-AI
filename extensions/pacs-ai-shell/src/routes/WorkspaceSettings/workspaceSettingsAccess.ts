import { Permission, can, type UserAccess } from '@pacs-ai/extension-core/src/access/permissions';
import {
  DEFAULT_WORKSPACE_SETTINGS_TAB,
  WORKSPACE_SETTINGS_TABS,
  type WorkspaceSettingsTabId,
} from './constants';

/** Which permission opens each Workspace Settings tab. Roles is OWNER/ADMIN only. */
export function canOpenWorkspaceSettingsTab(
  access: UserAccess | null | undefined,
  tab: WorkspaceSettingsTabId
): boolean {
  if (!access) {
    return false;
  }
  switch (tab) {
    case 'onboarding':
      return can(access, Permission.WORKSPACE_MANAGE);
    case 'dicom':
      return can(access, Permission.DICOM_MANAGE);
    case 'models':
      return can(access, Permission.MODELS_MANAGE);
    case 'ingestion':
      return can(access, Permission.PROCESSING_MANAGE);
    case 'feedback':
    case 'chat-feedback':
      return can(access, Permission.FEEDBACK_VIEW);
    case 'roles':
      return access.isAdmin;
    default:
      return false;
  }
}

export function getVisibleWorkspaceSettingsTabs(
  access: UserAccess | null | undefined
): WorkspaceSettingsTabId[] {
  return WORKSPACE_SETTINGS_TABS.map(tab => tab.id).filter(id =>
    canOpenWorkspaceSettingsTab(access, id)
  );
}

/** The requested tab when visible, else the default, else the first visible tab. */
export function resolveWorkspaceSettingsTab(
  requested: string | null,
  visible: readonly WorkspaceSettingsTabId[]
): WorkspaceSettingsTabId | null {
  if (requested && (visible as readonly string[]).includes(requested)) {
    return requested as WorkspaceSettingsTabId;
  }
  if (visible.includes(DEFAULT_WORKSPACE_SETTINGS_TAB)) {
    return DEFAULT_WORKSPACE_SETTINGS_TAB;
  }
  return visible[0] ?? null;
}
