import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_WORKSPACE_SETTINGS_TAB,
  isWorkspaceSettingsTabId,
  type WorkspaceSettingsTabId,
} from '../constants';

export function useWorkspaceSettingsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = isWorkspaceSettingsTabId(tabParam)
    ? tabParam
    : DEFAULT_WORKSPACE_SETTINGS_TAB;

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
