import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicPolicyLinks } from './publicPolicyLinks';

const policyLinkClassName =
  'font-medium text-primary-light underline underline-offset-2 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary';

const RegistrationPolicyLinks = ({ termsOfUseUrl, privacyPolicyUrl }: PublicPolicyLinks) => {
  const { t } = useTranslation('Onboarding');

  if (!termsOfUseUrl && !privacyPolicyUrl) {
    return null;
  }

  const externalLinkProps = {
    target: '_blank',
    rel: 'noopener noreferrer',
  } as const;

  return (
    <section
      className="mt-5 rounded-lg border border-white border-opacity-20 p-3 text-sm text-white text-opacity-80"
      aria-label={t('Policies')}
    >
      <p>{t('Review the policies that apply to this service before registering.')}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {termsOfUseUrl && (
          <li>
            <a
              href={termsOfUseUrl}
              aria-label={`${t('Terms of Use')} (${t('opens in a new tab')})`}
              className={policyLinkClassName}
              {...externalLinkProps}
            >
              {t('Terms of Use')}
            </a>
          </li>
        )}
        {privacyPolicyUrl && (
          <li>
            <a
              href={privacyPolicyUrl}
              aria-label={`${t('Privacy Policy')} (${t('opens in a new tab')})`}
              className={policyLinkClassName}
              {...externalLinkProps}
            >
              {t('Privacy Policy')}
            </a>
          </li>
        )}
      </ul>
    </section>
  );
};

export default RegistrationPolicyLinks;
