import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Typography } from '@ohif/ui';
import TopNavigation from '../../../components/TopNavigation';
import { Error } from '../../../api/dto';
import userRepository from '../../../api/userRepository';
import tenantRepository from '../../../api/tenantRepository';
import { logoutUser } from '../../../service/userService';
import { AlertContext } from '../../../AlertProvider';

/**
 * Apply placeholders to the consent link template
 *
 * @param template
 * @param name
 * @param email
 * @returns
 */
function applyConsentLinkPlaceholders(template: string, name: string, email: string): string {
  return template.replace('{NAME}', name).replace('{EMAIL}', email);
}

const UserConsentPage = () => {
  const { t } = useTranslation('Onboarding');
  const navigate = useNavigate();
  const showAlert = useContext(AlertContext);
  const [authReady, setAuthReady] = useState(false);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [loadingDocusignIframe, setLoadingDocusignIframe] = useState(true);
  const [consentIframeSrc, setConsentIframeSrc] = useState('');
  const tenantId = localStorage.getItem('tenantId') || '';

  useEffect(() => {
    const tid = localStorage.getItem('tenantId') || '';
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      navigate(`/login?t=${tid}`, { replace: true });
      return;
    }

    userRepository
      .GetCurrentUser()
      .then(userRes => {
        const user = userRes.data;
        return tenantRepository
          .GetTenantInfo()
          .then(tenantRes => tenantRes.data)
          .catch(() => undefined)
          .then(tenantData => {
            let consentLink = '';
            const link = tenantData?.onboardingConsentLink;
            if (link?.trim()) {
              consentLink = applyConsentLinkPlaceholders(link, user.name ?? '', user.email ?? '');
            }
            if (!consentLink.trim()) {
              consentLink = '';
            }
            setConsentIframeSrc(consentLink);
            setLoadingDocusignIframe(true);
            document.title = `${t('Informed Consent')} - PACS AI`;
            setAuthReady(true);
          });
      })
      .catch(() => {
        logoutUser(navigate, tid);
      });
  }, [navigate, t]);

  /**
   * Submit the consent form
   */
  const handleSubmitConsent = async () => {
    setIsSubmittingConsent(true);
    try {
      const response = await userRepository.GetCurrentUser();
      if (response.data.isConsentSigned) {
        navigate('/', { replace: true });
      } else {
        showAlert(t('Consent verification failed'), 'error');
      }
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }

      showAlert(error.message, 'error');
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  if (!authReady) {
    return <div className="min-h-screen bg-[#151815]" />;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#151815]">
      <TopNavigation title="Informed Consent" />

      <main className="ohif-scrollbar mx-auto flex min-h-0 w-full max-w-4xl grow flex-col overflow-y-auto px-6 pb-10 pt-6 sm:px-10">
        <Typography
          variant="h3"
          component="h1"
          className="text-white"
        >
          {t('Informed Consent')}
        </Typography>
        <Typography
          variant="body"
          component="p"
          className="mt-3 text-white text-opacity-70"
        >
          {t('Consent registration subtitle')}
        </Typography>

        <div className="mt-5 flex min-h-0 w-full flex-1 flex-col items-center sm:mt-7">
          {loadingDocusignIframe && (
            <div className="flex h-[400px] w-full items-center justify-center">
              <div
                className="h-14 w-14 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
                role="status"
                aria-label="Loading"
              />
            </div>
          )}
          <iframe
            title="Docusign Consent Form"
            src={consentIframeSrc}
            className="w-full max-w-full shrink-0 rounded-lg border-0"
            width="100%"
            height={loadingDocusignIframe ? 100 : 800}
            style={{ border: 'none' }}
            onLoad={() => setLoadingDocusignIframe(false)}
          />
          <Button
            disabled={isSubmittingConsent}
            className="mt-6 h-[51px] w-full shrink-0 rounded-lg !px-0 sm:max-w-[350px]"
            onClick={() => {
              handleSubmitConsent();
            }}
          >
            {isSubmittingConsent ? '...' : t('Submit Consent')}
          </Button>
        </div>
      </main>

      <footer className="shrink-0 py-6">
        <Typography
          variant="body"
          component="p"
          className="text-center font-light text-white text-opacity-70"
        >
          {t('© 2026 PACS AI. All rights reserved.')}
        </Typography>
      </footer>
    </div>
  );
};

export default UserConsentPage;
