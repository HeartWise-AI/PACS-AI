import { UserRole } from '../../api/userDTO';
import {
  getStudiesDestination,
  getTopNavigationItems,
  isTopNavigationItemActive,
} from './navigationModel';

describe('top navigation model', () => {
  test('keeps clinical destinations and gates the admin console by role', () => {
    expect(getTopNavigationItems('/', UserRole.USER).map(item => item.key)).toEqual([
      'studies',
      'ai-models',
      'ai-predictions',
    ]);
    expect(getTopNavigationItems('/', UserRole.ADMIN).map(item => item.key)).toEqual([
      'studies',
      'ai-models',
      'ai-predictions',
      'admin-console',
    ]);
    expect(getTopNavigationItems('/', UserRole.OWNER).slice(-1)[0]).toMatchObject({
      key: 'admin-console',
      opensInNewTab: true,
    });
  });

  test('keeps the admin destinations together and gates the return action by role', () => {
    expect(getTopNavigationItems('/admin/members', UserRole.USER).map(item => item.key)).toEqual([
      'members',
      'kibana-logs',
      'workspace-settings',
    ]);
    expect(getTopNavigationItems('/admin/members', UserRole.ADMIN).map(item => item.key)).toEqual([
      'members',
      'kibana-logs',
      'workspace-settings',
      'launch-pacs-ai',
    ]);
  });

  test.each(['/', '/viewer', '/viewer/dicomweb', '/segmentation'])(
    'identifies %s as the studies location',
    pathname => {
      const studies = getTopNavigationItems('/', UserRole.USER)[0];
      expect(isTopNavigationItemActive(studies, pathname)).toBe(true);
    }
  );

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
