import { UserRole } from '../api/userDTO';
import {
  ALL_PERMISSIONS,
  BASELINE_PERMISSIONS,
  GRANTABLE_PERMISSIONS,
  Permission,
  accessForRole,
  can,
  canUseModel,
  getAdminLandingPath,
  hasAdminArea,
  normalizeUserAccess,
} from './permissions';

describe('permissions', () => {
  it('splits baseline and grantable permissions', () => {
    expect(BASELINE_PERMISSIONS).toEqual(['models.use', 'feedback.vote']);
    expect(GRANTABLE_PERMISSIONS).not.toContain('models.use');
    expect(GRANTABLE_PERMISSIONS.length + BASELINE_PERMISSIONS.length).toBe(ALL_PERMISSIONS.length);
  });

  it.each([UserRole.OWNER, UserRole.ADMIN])('gives %s every permission and every model', role => {
    const access = normalizeUserAccess({ role, permissions: [], allModels: false, modelIds: [] });
    expect(access.isAdmin).toBe(true);
    ALL_PERMISSIONS.forEach(permission => expect(can(access, permission)).toBe(true));
    expect(canUseModel(access, 'Anything')).toBe(true);
    expect(getAdminLandingPath(access)).toBe('/admin/members');
  });

  it('gives a plain USER only the baseline', () => {
    const access = normalizeUserAccess({
      role: UserRole.USER,
      permissions: [],
      allModels: true,
      modelIds: [],
      customRole: null,
    });
    expect(can(access, Permission.MODELS_USE)).toBe(true);
    expect(can(access, Permission.FEEDBACK_VOTE)).toBe(true);
    expect(can(access, Permission.MEMBERS_INVITE)).toBe(false);
    expect(hasAdminArea(access)).toBe(false);
    expect(getAdminLandingPath(access)).toBeNull();
    expect(canUseModel(access, 'DeepRV_CLIP')).toBe(true);
  });

  it('adds custom role permissions and restricts models to the allowlist', () => {
    const access = normalizeUserAccess({
      role: UserRole.USER,
      permissions: ['feedback.view', 42 as unknown as string],
      allModels: false,
      modelIds: ['PanEcho'],
      customRole: { id: 'r1', name: 'Echo readers' },
    });
    expect(can(access, Permission.FEEDBACK_VIEW)).toBe(true);
    expect(can(access, Permission.MODELS_USE)).toBe(true);
    expect(canUseModel(access, 'PanEcho')).toBe(true);
    expect(canUseModel(access, 'DeepRV_CLIP')).toBe(false);
    expect(canUseModel(access, null)).toBe(false);
    expect(access.customRole).toEqual({ id: 'r1', name: 'Echo readers' });
    expect(getAdminLandingPath(access)).toBe('/admin/workspace-settings');
  });

  it('lands invite-only users on Members and log viewers on Kibana', () => {
    expect(
      getAdminLandingPath(
        normalizeUserAccess({ role: UserRole.USER, permissions: ['members.invite'] })
      )
    ).toBe('/admin/members');
    expect(
      getAdminLandingPath(normalizeUserAccess({ role: UserRole.USER, permissions: ['logs.view'] }))
    ).toBe('/admin/kibana-logs');
  });

  it('treats missing or unknown data as a plain USER', () => {
    const access = normalizeUserAccess(undefined);
    expect(access.role).toBe(UserRole.USER);
    expect(access.allModels).toBe(true);
    expect(can(null, Permission.MODELS_USE)).toBe(false);
    expect(canUseModel(null, 'x')).toBe(false);
  });

  it('derives role-only access for older gateways', () => {
    expect(accessForRole('ADMIN').isAdmin).toBe(true);
    expect([...accessForRole('USER').permissions]).toEqual([...BASELINE_PERMISSIONS]);
    expect(accessForRole(undefined).role).toBe(UserRole.USER);
  });
});
