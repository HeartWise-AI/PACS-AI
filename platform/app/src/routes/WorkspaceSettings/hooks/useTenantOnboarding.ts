import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertContext } from '../../../AlertProvider';
import tenantRepository from '../../../api/tenantRepository';
import { GetTenantInfoResponse } from '../../../api/tenantDTO';
import { handleUnauthorizedAccess } from '../utils';

export function useTenantOnboarding() {
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const tenantId = localStorage.getItem('tenantId') || '';

  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [informedConsentEnabled, setInformedConsentEnabled] = useState(false);
  const [isUpdatingOnboardingRegistration, setIsUpdatingOnboardingRegistration] = useState(false);
  const [isUpdatingOnboardingConsent, setIsUpdatingOnboardingConsent] = useState(false);

  const fetchTenantInfo = useCallback(async () => {
    try {
      const response = await tenantRepository.GetTenantInfo();
      setTenantInfo(response.data);
    } catch (error) {
      console.error(`Can't fetch tenant info: ${error}`);
    }
  }, []);

  useEffect(() => {
    fetchTenantInfo();
  }, [fetchTenantInfo]);

  useEffect(() => {
    if (!tenantInfo.id) {
      return;
    }
    setRegistrationEnabled(Boolean(tenantInfo.onboardingEnableRegistration));
    setInformedConsentEnabled(Boolean(tenantInfo.onboardingEnableConsent));
  }, [tenantInfo.id, tenantInfo.onboardingEnableRegistration, tenantInfo.onboardingEnableConsent]);

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

  return {
    tenantInfo,
    registrationEnabled,
    informedConsentEnabled,
    isUpdatingOnboardingRegistration,
    isUpdatingOnboardingConsent,
    handleToggleOnboardingRegistration,
    handleToggleOnboardingConsent,
  };
}

export type UseTenantOnboardingResult = ReturnType<typeof useTenantOnboarding>;
