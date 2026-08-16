import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Button, Logo, Typography } from '@ohif/ui';
import { AlertContext } from '../../AlertProvider';
import { Error } from '../../api/dto';
import type { ErrorAPIResponse } from '../../api/dto';
import userRepository from '../../api/userRepository';
import RegistrationPolicyLinks from '../Register/RegistrationPolicyLinks';
import {
  resolveRegistrationPolicyPair,
  type RegistrationPolicyPair,
} from '../Register/registrationPolicies';
import { getPolicyAcceptanceReturnPath } from '../../service/policyAcceptanceSession';
import { logoutUser, navigateAfterAuth } from '../../service/userService';

type LoadingStatus = 'loading' | 'ready' | 'error';

const PolicyAcceptancePage = () => {
  const { t } = useTranslation('Onboarding');
  const navigate = useNavigate();
  const location = useLocation();
  const showAlert = useContext(AlertContext) as (
    message: string,
    type: 'success' | 'error'
  ) => void;
  const [policies, setPolicies] = useState<RegistrationPolicyPair | null>(null);
  const [status, setStatus] = useState<LoadingStatus>('loading');
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const returnTo = getPolicyAcceptanceReturnPath(location.search);
  const tenantId = localStorage.getItem('tenantId') || '';

  const continueAfterAcceptance = async () => {
    const currentUser = await userRepository.GetCurrentUser();
    await navigateAfterAuth(navigate, currentUser.data, returnTo);
  };

  const loadPolicyStatus = async () => {
    if (!localStorage.getItem('sessionToken')) {
      logoutUser(navigate, tenantId, false);
      return;
    }

    setStatus('loading');
    setAccepted(false);
    try {
      const response = await userRepository.GetPolicyStatus();
      const currentPolicies = resolveRegistrationPolicyPair(response.data.policies);
      setPolicies(currentPolicies);
      setStatus('ready');
      if (!response.data.acceptanceRequired) {
        await continueAfterAcceptance();
      }
    } catch (failure) {
      const error = (failure || {}) as ErrorAPIResponse;
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        logoutUser(navigate, tenantId);
        return;
      }
      setPolicies(null);
      setStatus('error');
    }
  };

  useEffect(() => {
    document.title = `${t('Review service policies')} - PACS AI`;
    void loadPolicyStatus();
    // The destination is captured from the initial route; policy reloads should not
    // restart because callback identities change during rendering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accepted || !policies || isSubmitting) {
      checkboxRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await userRepository.AcceptPolicies({
        acceptances: policies.acceptances,
      });
      showAlert(t('Your policy acceptance has been recorded.'), 'success');
      await continueAfterAcceptance();
    } catch (failure) {
      const error = (failure || {}) as ErrorAPIResponse;
      setAccepted(false);
      if (
        error.errorCode === Error.POLICY_VERSION_STALE ||
        error.errorCode === Error.POLICY_ACCEPTANCE_REQUIRED
      ) {
        showAlert(t('The policies have changed. Please review the current versions.'), 'error');
        await loadPolicyStatus();
      } else if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        logoutUser(navigate, tenantId);
      } else {
        showAlert(t('Unable to record policy acceptance. Please try again.'), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#151815] px-5 py-10">
      <main className="border-opacity-15 w-full max-w-xl rounded-xl border border-white bg-black bg-opacity-20 p-6 shadow-xl sm:p-9">
        <Logo class="h-auto w-[180px]" />
        <Typography
          variant="h3"
          component="h1"
          className="mt-8 text-white"
        >
          {t('Review service policies')}
        </Typography>
        <Typography
          variant="body"
          component="p"
          className="mt-3 text-white text-opacity-70"
        >
          {t('Please review the current Terms and Privacy Policy before continuing to PACS AI.')}
        </Typography>

        <form onSubmit={handleSubmit}>
          <RegistrationPolicyLinks
            policies={policies}
            status={status}
            accepted={accepted}
            onAcceptedChange={setAccepted}
            onRetry={() => void loadPolicyStatus()}
            inputRef={checkboxRef}
          />
          <Button
            type="submit"
            disabled={status !== 'ready' || !accepted || isSubmitting}
            className="mt-5 h-[51px] w-full rounded-lg !px-0"
          >
            {isSubmitting ? t('Saving…') : t('Agree and continue')}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default PolicyAcceptancePage;
