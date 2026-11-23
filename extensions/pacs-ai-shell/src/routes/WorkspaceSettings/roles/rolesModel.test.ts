import { GRANTABLE_PERMISSIONS } from '@pacs-ai/extension-core/src/access/permissions';
import {
  EMPTY_ROLE_FORM,
  PERMISSION_GROUPS,
  countGrantedPermissions,
  getPermissionInfo,
  roleToForm,
  serializeRoleForm,
  sortRoles,
  toggleModel,
  togglePermission,
  validateRoleForm,
} from './rolesModel';

const role = {
  id: 'r1',
  name: 'Echo readers',
  description: 'Echo team',
  permissions: ['feedback.view', 'models.use', 'unknown.perm'],
  allModels: false,
  modelIds: ['PanEcho'],
  memberCount: 2,
  createdAt: 1,
  updatedAt: 2,
};

describe('roles model', () => {
  it('groups every grantable permission exactly once', () => {
    const grouped = PERMISSION_GROUPS.flatMap(group => group.permissions.map(p => p.id));
    expect([...grouped].sort()).toEqual([...GRANTABLE_PERMISSIONS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    GRANTABLE_PERMISSIONS.forEach(id => {
      expect(getPermissionInfo(id)?.description).toBeTruthy();
    });
  });

  it('loads a role into the form without baseline or unknown permissions', () => {
    expect(roleToForm(role)).toEqual({
      id: 'r1',
      name: 'Echo readers',
      description: 'Echo team',
      permissions: ['feedback.view'],
      allModels: false,
      modelIds: ['PanEcho'],
    });
    expect(countGrantedPermissions(role)).toBe(1);
  });

  it('toggles permissions and models', () => {
    let form = togglePermission(EMPTY_ROLE_FORM, 'members.invite');
    expect(form.permissions).toEqual(['members.invite']);
    form = togglePermission(form, 'members.invite');
    expect(form.permissions).toEqual([]);
    form = toggleModel(toggleModel(form, 'A'), 'B');
    expect(toggleModel(form, 'A').modelIds).toEqual(['B']);
  });

  it('validates name, description and model choice', () => {
    expect(validateRoleForm(EMPTY_ROLE_FORM, [])).toEqual(['nameRequired']);
    expect(validateRoleForm({ ...EMPTY_ROLE_FORM, name: 'x'.repeat(65) }, [])).toEqual([
      'nameTooLong',
    ]);
    expect(validateRoleForm({ ...EMPTY_ROLE_FORM, name: ' echo READERS ' }, [role])).toEqual([
      'nameTaken',
    ]);
    expect(validateRoleForm({ ...roleToForm(role), name: 'Echo readers' }, [role])).toEqual([]);
    expect(
      validateRoleForm(
        { ...EMPTY_ROLE_FORM, name: 'a', description: 'd'.repeat(281), allModels: false },
        []
      )
    ).toEqual(['descriptionTooLong', 'modelsRequired']);
  });

  it('serializes in catalog order and drops the allowlist when all models are allowed', () => {
    const form = {
      ...EMPTY_ROLE_FORM,
      name: '  Leads ',
      description: ' Team leads ',
      permissions: ['logs.view', 'members.invite', 'models.use'],
      allModels: false,
      modelIds: ['b', 'a', 'b'],
    };
    expect(serializeRoleForm(form)).toEqual({
      name: 'Leads',
      description: 'Team leads',
      permissions: ['members.invite', 'logs.view'],
      allModels: false,
      modelIds: ['a', 'b'],
    });
    expect(serializeRoleForm({ ...form, allModels: true }).modelIds).toEqual([]);
  });

  it('sorts roles by name, ignoring case', () => {
    expect(sortRoles([{ name: 'beta' }, { name: 'Alpha' }]).map(r => r.name)).toEqual([
      'Alpha',
      'beta',
    ]);
  });
});
