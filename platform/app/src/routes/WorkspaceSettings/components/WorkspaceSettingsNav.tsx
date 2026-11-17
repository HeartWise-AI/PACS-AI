import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  WORKSPACE_SETTINGS_TABS,
  type WorkspaceSettingsTabId,
} from '../constants';

type WorkspaceSettingsNavProps = {
  activeTab: WorkspaceSettingsTabId;
  onTabChange: (tab: WorkspaceSettingsTabId) => void;
};

const WorkspaceSettingsNav = ({
  activeTab,
  onTabChange,
}: WorkspaceSettingsNavProps) => {
  const { t } = useTranslation('Common');

  return (
    <nav
      className="mb-5 flex flex-wrap gap-1 border-b border-white border-opacity-10"
      role="tablist"
      aria-label={t('Workspace Settings')}
    >
      {WORKSPACE_SETTINGS_TABS.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            id={`workspace-settings-tab-${tab.id}`}
            aria-controls={`workspace-settings-panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`border-b-2 px-4 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6ED47C] ${
              isActive
                ? 'border-[#6ED47C] font-semibold text-white'
                : 'border-transparent text-white text-opacity-60 hover:text-white'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </nav>
  );
};

export default WorkspaceSettingsNav;
