import { UserRole } from '@pacs-ai/extension-core/src/api/userDTO';
import { canAssignCustomRole, getCustomRoleChange, getCustomRoleName } from './memberCustomRoles';

describe('member custom roles', () => {
  const roles = [{ id: 'r1', name: 'Echo readers' }];

  it('names the assigned role', () => {
    expect(getCustomRoleName(roles, 'r1')).toBe('Echo readers');
    expect(getCustomRoleName(roles, 'gone')).toBeNull();
    expect(getCustomRoleName(roles, '')).toBeNull();
  });

  it('lets only admins assign, and only to users', () => {
    expect(canAssignCustomRole(true, UserRole.USER)).toBe(true);
    expect(canAssignCustomRole(true, UserRole.ADMIN)).toBe(false);
    expect(canAssignCustomRole(false, UserRole.USER)).toBe(false);
  });

  it('reports a change only when the id differs for a USER', () => {
    expect(getCustomRoleChange('', 'r1', UserRole.USER)).toBe('r1');
    expect(getCustomRoleChange('r1', '', UserRole.USER)).toBe('');
    expect(getCustomRoleChange(undefined, '', UserRole.USER)).toBeNull();
    expect(getCustomRoleChange('r1', 'r1', UserRole.USER)).toBeNull();
    expect(getCustomRoleChange('r1', '', UserRole.ADMIN)).toBeNull();
  });
});
