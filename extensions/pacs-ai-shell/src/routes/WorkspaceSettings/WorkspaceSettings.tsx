import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Permission } from '@pacs-ai/extension-core/src/access/permissions';
import { useUserAccess } from '@pacs-ai/extension-core/src/hooks/useUserAccess';
import TopNavigation from '../../components/TopNavigation';
import WorkspaceSettingsNav from './components/WorkspaceSettingsNav';
import { useDicomModalities } from './hooks/useDicomModalities';
import { useInferenceModels } from './hooks/useInferenceModels';
import { useIngestionJobs } from './hooks/useIngestionJobs';
import { useTenantOnboarding } from './hooks/useTenantOnboarding';
import { useWorkspaceSettingsTab } from './hooks/useWorkspaceSettingsTab';
import TenantHeader from './onboarding/components/TenantHeader';
import DicomModalitiesSection from './sections/DicomModalitiesSection';
import InferenceModelsSection from './sections/InferenceModelsSection';
import IngestionJobsSection from './sections/IngestionJobsSection';
import ChatFeedbackSection from './sections/ChatFeedbackSection';
import ModelFeedbackSection from './sections/ModelFeedbackSection';
import OnboardingSection from './sections/OnboardingSection';
import RolesSection from './sections/RolesSection';
import { useCustomRoles } from './roles/useCustomRoles';
import { getVisibleWorkspaceSettingsTabs } from './workspaceSettingsAccess';
import type { WorkspaceSettingsTabId } from './constants';

const WorkspaceSettingsPage = () => {
  const { t } = useTranslation('Common');
  const { access, loading: accessLoading, can } = useUserAccess();
  const visibleTabs = useMemo(() => getVisibleWorkspaceSettingsTabs(access), [access]);
  const isVisible = (tab: WorkspaceSettingsTabId) => visibleTabs.includes(tab);
  const { activeTab, setActiveTab } = useWorkspaceSettingsTab(visibleTabs);
  const onboarding = useTenantOnboarding();
  // Each tab's data loads only for users allowed to open it; the gateway
  // enforces the same permissions.
  const dicom = useDicomModalities({
    enabled: isVisible('dicom') || isVisible('ingestion'),
    probeStatus: isVisible('dicom'),
  });
  const inference = useInferenceModels({ enabled: isVisible('models') });
  const ingestion = useIngestionJobs({
    availableModels: inference.availableModels,
    enabled: isVisible('ingestion'),
    loadMembers: can(Permission.MEMBERS_MANAGE),
  });
  const roles = useCustomRoles({ enabled: isVisible('roles') });

  useEffect(() => {
    document.title = 'Admin Workspace Settings - PACS AI';
  }, []);

  const panelProps = (tab: WorkspaceSettingsTabId) => ({
    id: `workspace-settings-panel-${tab}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `workspace-settings-tab-${tab}`,
    hidden: activeTab !== tab,
  });

  const noAccess = !accessLoading && visibleTabs.length === 0;

  return (
    <div className="flex h-screen w-screen flex-col overflow-x-hidden bg-[#151815]">
      <TopNavigation title="Workspace Settings" />
      <main className="ohif-scrollbar mx-auto min-h-0 w-full max-w-[1900px] grow overflow-y-auto px-4 pb-8 pt-5 sm:px-5 lg:px-7">
        <div className="mb-5 rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
          <TenantHeader tenantInfo={onboarding.tenantInfo} />
          <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
          <WorkspaceSettingsNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            visibleTabs={visibleTabs}
          />

          {accessLoading && visibleTabs.length === 0 && (
            <p className="text-sm text-white text-opacity-60">{t('Loading...')}</p>
          )}
          {noAccess && (
            <p className="text-sm text-white text-opacity-60">
              {t('Your role does not include any workspace settings.')}
            </p>
          )}

          {isVisible('onboarding') && (
            <div {...panelProps('onboarding')}>
              <OnboardingSection onboarding={onboarding} />
            </div>
          )}
          {isVisible('dicom') && (
            <div {...panelProps('dicom')}>
              <DicomModalitiesSection dicom={dicom} />
            </div>
          )}
          {isVisible('models') && (
            <div {...panelProps('models')}>
              <InferenceModelsSection
                inference={inference}
                active={activeTab === 'models'}
              />
            </div>
          )}
          {isVisible('ingestion') && (
            <div {...panelProps('ingestion')}>
              <IngestionJobsSection
                ingestion={ingestion}
                dicomModalities={dicom.modalities}
                availableModels={inference.availableModels}
              />
            </div>
          )}
          {isVisible('feedback') && (
            <div {...panelProps('feedback')}>
              <ModelFeedbackSection
                active={activeTab === 'feedback'}
                availableModels={inference.availableModels}
                tenantName={onboarding.tenantInfo.name}
              />
            </div>
          )}
          {isVisible('chat-feedback') && (
            <div {...panelProps('chat-feedback')}>
              <ChatFeedbackSection
                active={activeTab === 'chat-feedback'}
                showRaw={Boolean(access?.isAdmin)}
              />
            </div>
          )}
          {isVisible('roles') && (
            <div {...panelProps('roles')}>
              <RolesSection
                roles={roles}
                availableModels={inference.availableModels}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default WorkspaceSettingsPage;
