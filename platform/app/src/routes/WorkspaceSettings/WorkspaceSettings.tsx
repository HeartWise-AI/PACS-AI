import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import { AlertContext } from '../../AlertProvider';
import copyIcon from './../../assets/pacs/icons/copy-gradient.png';
import tenantRepository from '../../api/tenantRepository';
import { GetTenantInfoResponse } from '../../api/tenantDTO';
import { handleUnauthorizedAccess } from './utils';
import { useDicomModalities } from './hooks/useDicomModalities';
import { useInferenceModels } from './hooks/useInferenceModels';
import { useIngestionJobs } from './hooks/useIngestionJobs';
import DicomModalitiesSection from './sections/DicomModalitiesSection';
import InferenceModelsSection from './sections/InferenceModelsSection';
import IngestionJobsSection from './sections/IngestionJobsSection';

const WorkspaceSettingsPage = () => {
  const { t } = useTranslation('Common');
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';
  const dicom = useDicomModalities();
  const inference = useInferenceModels();
  const ingestion = useIngestionJobs({ availableModels: inference.availableModels });
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [informedConsentEnabled, setInformedConsentEnabled] = useState(false);
  const [isUpdatingOnboardingRegistration, setIsUpdatingOnboardingRegistration] = useState(false);
  const [isUpdatingOnboardingConsent, setIsUpdatingOnboardingConsent] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'Admin Workspace Settings - PACS AI';
  }, []);

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantRepository.GetTenantInfo();
        setTenantInfo(response.data);
      } catch (error) {
        console.error(`Can't fetch tenant info: ${error}`);
      }
    };
    fetchTenantInfo();
  }, [tenantRepository]);

  useEffect(() => {
    if (!tenantInfo.id) {
      return;
    }
    setRegistrationEnabled(Boolean(tenantInfo.onboardingEnableRegistration));
    setInformedConsentEnabled(Boolean(tenantInfo.onboardingEnableConsent));
  }, [tenantInfo.id, tenantInfo.onboardingEnableRegistration, tenantInfo.onboardingEnableConsent]);

  /**
   * Handle toggle onboarding registration
   *
   * @param next
   */
  const handleToggleOnboardingRegistration = async (next: boolean) => {
    setIsUpdatingOnboardingRegistration(true);
    try {
      const response = await tenantRepository.UpdateOnboardingRegistrationConfig({
        onboardingEnableRegistration: next,
      });
      showAlert(response.message, 'success');
      setRegistrationEnabled(next);
      setTenantInfo(prev => ({ ...prev, onboardingEnableRegistration: next }));
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error updating onboarding registration config: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsUpdatingOnboardingRegistration(false);
  };

  /**
   * Handle toggle onboarding consent
   *
   * @param next
   */
  const handleToggleOnboardingConsent = async (next: boolean) => {
    setIsUpdatingOnboardingConsent(true);
    try {
      const response = await tenantRepository.UpdateOnboardingConsentConfig({
        onboardingEnableConsent: next,
      });
      showAlert(response.message, 'success');
      setInformedConsentEnabled(next);
      setTenantInfo(prev => ({ ...prev, onboardingEnableConsent: next }));
    } catch (error) {
      handleUnauthorizedAccess(error, showAlert, navigate, tenantId);
      console.error(`Error updating onboarding consent config: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsUpdatingOnboardingConsent(false);
  };

  /**
   * Onboarding toggle button
   *
   * @param checked
   * @param onToggle
   * @param id
   * @param disabled
   */
  const onboardingToggleButton = (
    checked: boolean,
    onToggle: (next: boolean) => void,
    id: string,
    disabled = false
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={disabled}
      id={id}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onToggle(!checked);
        }
      }}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6ED47C] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-gradient-to-r from-[#C8F469] to-[#05905E]' : 'bg-white bg-opacity-20'
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );


  /**
   * Copy to clipboard button
   *
   * @param text
   */
  const CopyToClipboardButton = ({ text }) => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(text).then(() => {
        showAlert('Copy to clipboard success', 'success');
      });
    };

    return (
      <button className="p-0 focus:ring-0">
        <img
          src={copyIcon}
          alt="Copy icon"
          className="ml-2 h-5 w-5 cursor-pointer"
          onClick={copyToClipboard}
        />
      </button>
    );
  };

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        <SidebarAdmin />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Workspace Settings" />
          <div className="mb-5 rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            {tenantInfo.name ? (
              <div>
                <h1 className="text-2xl text-white">{tenantInfo.name}</h1>
                <div className="flex flex-col text-sm font-light text-white text-opacity-70 sm:flex-row sm:items-center">
                  <div className="flex items-center sm:ml-1">
                    {tenantInfo.id}
                    <CopyToClipboardButton text={tenantInfo.id} />
                  </div>
                </div>
              </div>
            ) : (
              <div
                role="tenantInfo"
                className={`grid max-w-full animate-pulse grid-cols-9 gap-4`}
              >
                <div>
                  <div className='className="mb-2 mb-2 h-7 w-[250px] rounded-lg bg-gray-200 bg-opacity-30'></div>
                  <div className='className="mb-2 mb-2 h-2 w-[150px] rounded-lg bg-gray-200 bg-opacity-30'></div>
                </div>
              </div>
            )}
            {/* divider */}
            <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
            {/* user onboarding */}
            <div className="mb-6">
              <Typography
                variant="h6"
                component="h2"
                className="mb-3 font-semibold text-white"
              >
                {t('User Onboarding')}
              </Typography>
              <div className="rounded-xl border border-white border-opacity-10 bg-[#1a1c1a] p-5">
                <div className="flex flex-col border-b border-white border-opacity-10 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white">{t('Registration')}</div>
                    <p className="mt-1 text-sm text-white text-opacity-70">
                      {t('Enable registration for new users')}
                    </p>
                  </div>
                  <div className="mt-3 flex shrink-0 justify-end sm:mt-0">
                    {onboardingToggleButton(
                      registrationEnabled,
                      handleToggleOnboardingRegistration,
                      'toggle-registration',
                      isUpdatingOnboardingRegistration
                    )}
                  </div>
                </div>
                <div className="flex flex-col pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white">{t('Informed Consent')}</div>
                    <p className="mt-1 text-sm text-white text-opacity-70">
                      {t('Enable informed consent for new users')}
                    </p>
                  </div>
                  <div className="mt-3 flex shrink-0 justify-end sm:mt-0">
                    {onboardingToggleButton(
                      informedConsentEnabled,
                      handleToggleOnboardingConsent,
                      'toggle-informed-consent',
                      isUpdatingOnboardingConsent
                    )}
                  </div>
                </div>
                {informedConsentEnabled && (
                  <div className="mt-4 flex w-full flex-col gap-2 rounded-lg border border-white/10 bg-[#2a2f2a] px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                    <span
                      className="text-opacity-85 min-w-0 flex-1 truncate text-sm text-white"
                      title={tenantInfo.onboardingConsentLink || undefined}
                    >
                      {tenantInfo.onboardingConsentLink?.trim() || t('No consent URL configured')}
                    </span>
                    <button
                      type="button"
                      disabled={!tenantInfo.onboardingConsentLink?.trim()}
                      onClick={() => {
                        const url = tenantInfo.onboardingConsentLink?.trim();
                        if (url) {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#a5e06f]/10 px-4 py-2 text-sm font-semibold text-[#a5e06f] transition-colors hover:bg-[#4a5e4a] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('DocuSign Preview')}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <DicomModalitiesSection dicom={dicom} />
            {/* divider */}
            <div className="my-5 h-px w-full bg-white bg-opacity-10"></div>
            <InferenceModelsSection inference={inference} />
            {/* divider */}
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
