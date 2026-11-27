import {
  Permission,
  can,
  canAny,
  getAdminLandingPath,
  hasAdminArea,
  isAdminRole,
  WORKSPACE_SETTINGS_PERMISSIONS,
  type UserAccess,
} from '@pacs-ai/extension-core/src/access/permissions';
import { withoutPatientIdentifiers } from '@pacs-ai/extension-core/src/utils/viewerUrl';

export { isAdminRole };

export type TopNavigationItemKey =
  | 'studies'
  | 'ai-models'
  | 'ai-predictions'
  | 'admin-console'
  | 'members'
  | 'kibana-logs'
  | 'workspace-settings'
  | 'launch-pacs-ai';

export interface TopNavigationItem {
  key: TopNavigationItemKey;
  label: string;
  to?: string;
  disabled?: boolean;
  opensInNewTab?: boolean;
}

export const isAdminPath = (pathname: string): boolean => pathname.startsWith('/admin/');

/**
 * Builds the top navigation from the user's effective access. OWNER/ADMIN see
 * every admin page; a custom role sees only the pages its permissions open.
 * The gateway enforces the same permissions on every admin API.
 */
export const getTopNavigationItems = (
  pathname: string,
  access?: UserAccess | null
): TopNavigationItem[] => {
  if (isAdminPath(pathname)) {
    const items: TopNavigationItem[] = [];
    if (canAny(access, [Permission.MEMBERS_INVITE, Permission.MEMBERS_MANAGE])) {
      items.push({ key: 'members', label: 'Members', to: '/admin/members' });
    }
    if (can(access, Permission.LOGS_VIEW)) {
      items.push({ key: 'kibana-logs', label: 'Kibana Logs', to: '/admin/kibana-logs' });
    }
    if (access?.isAdmin || canAny(access, WORKSPACE_SETTINGS_PERMISSIONS)) {
      items.push({
        key: 'workspace-settings',
        label: 'Workspace Settings',
        to: '/admin/workspace-settings',
      });
    }
    items.push({ key: 'launch-pacs-ai', label: 'Launch PACS AI', to: '/' });
    return items;
  }

  const adminLanding = getAdminLandingPath(access);
  return [
    { key: 'studies', label: 'Studies', to: '/' },
    { key: 'ai-models', label: 'AI Models', to: '/ai-models' },
    { key: 'ai-predictions', label: 'AI Predictions', to: '/ai-predictions' },
    ...(hasAdminArea(access) && adminLanding
      ? [
          {
            key: 'admin-console' as const,
            label: 'Admin Console',
            to: adminLanding,
            opensInNewTab: true,
          },
        ]
      : []),
  ];
};

export const isTopNavigationItemActive = (item: TopNavigationItem, pathname: string): boolean => {
  switch (item.key) {
    case 'studies':
      return (
        pathname === '/' || pathname.startsWith('/viewer') || pathname.startsWith('/segmentation')
      );
    case 'ai-models':
      return pathname === '/ai-models';
    case 'ai-predictions':
      return pathname === '/ai-predictions';
    case 'members':
      return pathname === '/admin/members';
    case 'kibana-logs':
      return pathname === '/admin/kibana-logs';
    case 'workspace-settings':
      return pathname === '/admin/workspace-settings';
    default:
      return false;
  }
};

export const getStudiesDestination = (pathname: string, search: string): string => {
  if (!pathname.startsWith('/viewer') && !pathname.startsWith('/segmentation')) {
    return '/';
  }

  // Patient identifiers never go back into a URL (old viewer links carried them).
  const searchParams = withoutPatientIdentifiers(search);
  searchParams.delete('StudyInstanceUIDs');
  const retainedSearch = searchParams.toString();
  return retainedSearch ? `/?${retainedSearch}` : '/';
};
