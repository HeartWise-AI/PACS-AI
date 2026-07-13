import React, { useEffect } from 'react';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import { useDicomModalities } from './hooks/useDicomModalities';
import { useInferenceModels } from './hooks/useInferenceModels';
import { useIngestionJobs } from './hooks/useIngestionJobs';
import { useTenantOnboarding } from './hooks/useTenantOnboarding';
import DicomModalitiesSection from './sections/DicomModalitiesSection';
import InferenceModelsSection from './sections/InferenceModelsSection';
import IngestionJobsSection from './sections/IngestionJobsSection';
import OnboardingSection from './sections/OnboardingSection';

const WorkspaceSettingsPage = () => {
  const onboarding = useTenantOnboarding();
  const dicom = useDicomModalities();
  const inference = useInferenceModels();
  const ingestion = useIngestionJobs({ availableModels: inference.availableModels });

  useEffect(() => {
    document.title = 'Admin Workspace Settings - PACS AI';
  }, []);

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        <SidebarAdmin />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Workspace Settings" />
          <div className="mb-5 rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <OnboardingSection onboarding={onboarding} />
            <DicomModalitiesSection dicom={dicom} />
            <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
            <InferenceModelsSection inference={inference} />
            <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
            <IngestionJobsSection
              ingestion={ingestion}
              dicomModalities={dicom.modalities}
              availableModels={inference.availableModels}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSettingsPage;
