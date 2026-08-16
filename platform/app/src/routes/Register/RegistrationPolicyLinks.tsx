import React, { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { RegistrationPolicyPair } from './registrationPolicies';

const policyLinkClassName =
  'font-medium text-primary-light underline underline-offset-2 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary';

interface RegistrationPolicyLinksProps {
  policies: RegistrationPolicyPair | null;
  status: 'loading' | 'ready' | 'error';
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onRetry: () => void;
  inputRef?: RefObject<HTMLInputElement>;
}

const RegistrationPolicyLinks = ({
  policies,
  status,
  accepted,
  onAcceptedChange,
  onRetry,
  inputRef,
}: RegistrationPolicyLinksProps) => {
  const { t } = useTranslation('Onboarding');

  const externalLinkProps = {
    target: '_blank',
    rel: 'noopener noreferrer',
  } as const;

  return (
    <section
      className="mt-5 rounded-lg border border-white border-opacity-20 p-3 text-sm text-white text-opacity-80"
      aria-label={t('Policies')}
    >
      {status === 'loading' && (
        <p
          role="status"
          aria-live="polite"
        >
          {t('Loading Terms and Privacy Policy…')}
        </p>
      )}
      {status === 'error' && (
        <div
          role="alert"
          className="space-y-2"
        >
          <p>{t('Terms and Privacy Policy are temporarily unavailable.')}</p>
          <button
            type="button"
            className={policyLinkClassName}
            onClick={onRetry}
          >
            {t('Try loading policies again')}
          </button>
        </div>
      )}
      {status === 'ready' && policies && (
        <div className="flex items-start gap-3">
          <input
            ref={inputRef}
            id="register-policy-acceptance"
            type="checkbox"
            className="accent-primary mt-1 h-4 w-4 shrink-0"
            checked={accepted}
            onChange={event => onAcceptedChange(event.target.checked)}
            aria-label={t('I agree to the Terms of Service and acknowledge the Privacy Policy.')}
            aria-describedby="register-policy-acceptance-copy"
          />
          <p id="register-policy-acceptance-copy">
            <label htmlFor="register-policy-acceptance">{t('I agree to the')} </label>
            <a
              href={policies.terms.url}
              aria-label={`${t('Terms of Service')} (${t('opens in a new tab')})`}
              className={policyLinkClassName}
              {...externalLinkProps}
            >
              {t('Terms of Service')}
            </a>{' '}
            {t('and acknowledge the')}{' '}
            <a
              href={policies.privacy.url}
              aria-label={`${t('Privacy Policy')} (${t('opens in a new tab')})`}
              className={policyLinkClassName}
              {...externalLinkProps}
            >
              {t('Privacy Policy')}
            </a>
            .
          </p>
        </div>
      )}
    </section>
  );
};

export default RegistrationPolicyLinks;
