import { UserRole } from '@pacs-ai/extension-core/src/api/userDTO';
import { normalizeUserAccess } from '@pacs-ai/extension-core/src/access/permissions';
import {
  getVisibleWorkspaceSettingsTabs,
  resolveWorkspaceSettingsTab,
} from './workspaceSettingsAccess';

const accessOf = (role: UserRole, permissions: string[] = []) =>
  normalizeUserAccess({ role, permissions, allModels: true, modelIds: [], customRole: null });

describe('workspace settings access', () => {
  it('shows admins every tab including Roles', () => {
    expect(getVisibleWorkspaceSettingsTabs(accessOf(UserRole.ADMIN))).toEqual([
      'onboarding',
      'dicom',
      'models',
      'ingestion',
      'feedback',
      'chat-feedback',
      'roles',
    ]);
  });

  it('shows a custom role only its tabs and never Roles', () => {
    expect(
      getVisibleWorkspaceSettingsTabs(
        accessOf(UserRole.USER, ['feedback.view', 'processing.manage', 'members.manage'])
      )
    ).toEqual(['ingestion', 'feedback', 'chat-feedback']);
    expect(getVisibleWorkspaceSettingsTabs(accessOf(UserRole.USER))).toEqual([]);
    expect(getVisibleWorkspaceSettingsTabs(null)).toEqual([]);
  });

  it('falls back to a visible tab when the requested one is hidden', () => {
    expect(resolveWorkspaceSettingsTab('roles', ['onboarding', 'roles'])).toBe('roles');
    expect(resolveWorkspaceSettingsTab('roles', ['ingestion', 'feedback'])).toBe('ingestion');
    expect(resolveWorkspaceSettingsTab(null, ['onboarding', 'dicom'])).toBe('onboarding');
    expect(resolveWorkspaceSettingsTab('chat-feedback', ['feedback', 'chat-feedback'])).toBe(
      'chat-feedback'
    );
    expect(resolveWorkspaceSettingsTab('bogus', [])).toBeNull();
  });
});
