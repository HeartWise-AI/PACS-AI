import React, { useEffect } from 'react';
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
import OnboardingSection from './sections/OnboardingSection';
import type { WorkspaceSettingsTabId } from './constants';

const WorkspaceSettingsPage = () => {
  const { activeTab, setActiveTab } = useWorkspaceSettingsTab();
  const onboarding = useTenantOnboarding();
  const dicom = useDicomModalities();
  const inference = useInferenceModels();
  const ingestion = useIngestionJobs({ availableModels: inference.availableModels });

  useEffect(() => {
    document.title = 'Admin Workspace Settings - PACS AI';
  }, []);

  const panelProps = (tab: WorkspaceSettingsTabId) => ({
    id: `workspace-settings-panel-${tab}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `workspace-settings-tab-${tab}`,
    hidden: activeTab !== tab,
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-x-hidden bg-[#151815]">
      <TopNavigation title="Workspace Settings" />
      <main className="ohif-scrollbar mx-auto min-h-0 w-full max-w-[1900px] grow overflow-y-auto px-4 pb-8 pt-5 sm:px-5 lg:px-7">
          <div className="mb-5 rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <TenantHeader tenantInfo={onboarding.tenantInfo} />
            <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
            <WorkspaceSettingsNav activeTab={activeTab} onTabChange={setActiveTab} />

            <div {...panelProps('onboarding')}>
              <OnboardingSection onboarding={onboarding} />
            </div>
            <div {...panelProps('dicom')}>
              <DicomModalitiesSection dicom={dicom} />
            </div>
            <div {...panelProps('models')}>
              <InferenceModelsSection inference={inference} />
            </div>
            <div {...panelProps('ingestion')}>
              <IngestionJobsSection
                ingestion={ingestion}
                dicomModalities={dicom.modalities}
                availableModels={inference.availableModels}
              />
            </div>
          </div>
      </main>
    </div>
  );
};

export default WorkspaceSettingsPage;
