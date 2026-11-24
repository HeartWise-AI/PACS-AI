import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WORKSPACE_SETTINGS_TABS, type WorkspaceSettingsTabId } from '../constants';
import { resolveWorkspaceSettingsTab } from '../workspaceSettingsAccess';

const ALL_TAB_IDS = WORKSPACE_SETTINGS_TABS.map(tab => tab.id);

/**
 * Active tab from `?tab=`, limited to the tabs the user may open. Returns null
 * when no tab is visible (no permission, or access still loading).
 */
export function useWorkspaceSettingsTab(
  visibleTabs: readonly WorkspaceSettingsTabId[] = ALL_TAB_IDS
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveWorkspaceSettingsTab(searchParams.get('tab'), visibleTabs);

  const setActiveTab = useCallback(
    (tab: WorkspaceSettingsTabId) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.set('tab', tab);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { activeTab, setActiveTab };
}
