import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@ohif/ui';
import type { UseTenantOnboardingResult } from '../hooks/useTenantOnboarding';
import OnboardingToggle from '../onboarding/components/OnboardingToggle';

type OnboardingSectionProps = {
  onboarding: UseTenantOnboardingResult;
};

const OnboardingSection = ({ onboarding }: OnboardingSectionProps) => {
  const { t } = useTranslation('Common');
  const {
    tenantInfo,
    registrationEnabled,
    informedConsentEnabled,
    isUpdatingOnboardingRegistration,
    isUpdatingOnboardingConsent,
    handleToggleOnboardingRegistration,
    handleToggleOnboardingConsent,
  } = onboarding;

  return (
    <div>
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
            <OnboardingToggle
              checked={registrationEnabled}
              onToggle={handleToggleOnboardingRegistration}
              id="toggle-registration"
              disabled={isUpdatingOnboardingRegistration}
            />
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
            <OnboardingToggle
              checked={informedConsentEnabled}
              onToggle={handleToggleOnboardingConsent}
              id="toggle-informed-consent"
              disabled={isUpdatingOnboardingConsent}
            />
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
  );
};

export default OnboardingSection;
