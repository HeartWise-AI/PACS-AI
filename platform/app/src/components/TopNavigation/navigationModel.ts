import { UserRole } from '../../api/userDTO';

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

const ADMIN_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.OWNER]);

export const isAdminRole = (role?: UserRole | null): boolean =>
  role != null && ADMIN_ROLES.has(role);

export const isAdminPath = (pathname: string): boolean => pathname.startsWith('/admin/');

export const getTopNavigationItems = (
  pathname: string,
  role?: UserRole | null
): TopNavigationItem[] => {
  if (isAdminPath(pathname)) {
    return [
      { key: 'members', label: 'Members', to: '/admin/members' },
      { key: 'kibana-logs', label: 'Kibana Logs', to: '/admin/kibana-logs' },
      {
        key: 'workspace-settings',
        label: 'Workspace Settings',
        to: '/admin/workspace-settings',
      },
      ...(isAdminRole(role)
        ? [{ key: 'launch-pacs-ai' as const, label: 'Launch PACS AI', to: '/' }]
        : []),
    ];
  }

  return [
    { key: 'studies', label: 'Studies', to: '/' },
    { key: 'ai-models', label: 'AI Models', to: '/ai-models' },
    { key: 'ai-predictions', label: 'AI Predictions', disabled: true },
    ...(isAdminRole(role)
      ? [
          {
            key: 'admin-console' as const,
            label: 'Admin Console',
            to: '/admin/members',
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

  const searchParams = new URLSearchParams(search);
  searchParams.delete('StudyInstanceUIDs');
  const retainedSearch = searchParams.toString();
  return retainedSearch ? `/?${retainedSearch}` : '/';
};
