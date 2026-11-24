import { UserRole } from '@pacs-ai/extension-core/src/api/userDTO';
import { normalizeUserAccess } from '@pacs-ai/extension-core/src/access/permissions';
import {
  getStudiesDestination,
  getTopNavigationItems,
  isTopNavigationItemActive,
} from './navigationModel';

const accessOf = (role: UserRole, permissions: string[] = []) =>
  normalizeUserAccess({ role, permissions, allModels: true, modelIds: [], customRole: null });

describe('top navigation model', () => {
  test('keeps clinical destinations and gates the admin console by role', () => {
    expect(getTopNavigationItems('/', accessOf(UserRole.USER)).map(item => item.key)).toEqual([
      'studies',
      'ai-models',
      'ai-predictions',
    ]);
    expect(getTopNavigationItems('/', accessOf(UserRole.ADMIN)).map(item => item.key)).toEqual([
      'studies',
      'ai-models',
      'ai-predictions',
      'admin-console',
    ]);
    expect(getTopNavigationItems('/', accessOf(UserRole.OWNER)).slice(-1)[0]).toMatchObject({
      key: 'admin-console',
      opensInNewTab: true,
    });
  });

  test('shows admins every admin destination and custom roles only theirs', () => {
    expect(
      getTopNavigationItems('/admin/members', accessOf(UserRole.USER)).map(item => item.key)
    ).toEqual(['launch-pacs-ai']);
    expect(
      getTopNavigationItems('/admin/members', accessOf(UserRole.USER, ['members.invite'])).map(
        item => item.key
      )
    ).toEqual(['members', 'launch-pacs-ai']);
    expect(
      getTopNavigationItems(
        '/admin/members',
        accessOf(UserRole.USER, ['feedback.view', 'logs.view'])
      ).map(item => item.key)
    ).toEqual(['kibana-logs', 'workspace-settings', 'launch-pacs-ai']);
    expect(
      getTopNavigationItems('/admin/members', accessOf(UserRole.ADMIN)).map(item => item.key)
    ).toEqual(['members', 'kibana-logs', 'workspace-settings', 'launch-pacs-ai']);
  });

  test.each(['/', '/viewer', '/viewer/dicomweb', '/segmentation'])(
    'identifies %s as the studies location',
    pathname => {
      const studies = getTopNavigationItems('/', accessOf(UserRole.USER))[0];
      expect(isTopNavigationItemActive(studies, pathname)).toBe(true);
    }
  );

  test('opens the admin console on the first page a custom role may use', () => {
    const item = getTopNavigationItems('/', accessOf(UserRole.USER, ['feedback.view'])).slice(
      -1
    )[0];
    expect(item).toMatchObject({ key: 'admin-console', to: '/admin/workspace-settings' });
    expect(getTopNavigationItems('/', null).map(i => i.key)).not.toContain('admin-console');
  });

  test('links the AI Predictions page and marks it active there only', () => {
    const predictions = getTopNavigationItems('/', accessOf(UserRole.USER)).find(
      item => item.key === 'ai-predictions'
    );
    expect(predictions).toMatchObject({ to: '/ai-predictions' });
    expect(predictions?.disabled).toBeFalsy();
    expect(isTopNavigationItemActive(predictions!, '/ai-predictions')).toBe(true);
    expect(isTopNavigationItemActive(predictions!, '/ai-models')).toBe(false);
  });

  test('retains worklist search context when leaving a viewer route', () => {
    expect(
      getStudiesDestination(
        '/viewer',
        '?StudyInstanceUIDs=1.2.3&PatientName=Smith&ModalitiesInStudy=CT'
      )
    ).toBe('/?PatientName=Smith&ModalitiesInStudy=CT');
    expect(getStudiesDestination('/ai-models', '?PatientName=Smith')).toBe('/');
  });
});
