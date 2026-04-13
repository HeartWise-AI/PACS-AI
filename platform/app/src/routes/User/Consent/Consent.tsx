import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Logo, Typography } from '@ohif/ui';
import userRepository from '../../../api/userRepository';
import tenantRepository from '../../../api/tenantRepository';
import type { UserResponse } from '../../../api/userDTO';
import { logoutUser } from '../../../service/userService';
import chevronDownIcon from '../../../assets/pacs/icons/chevron-down.png';

/**
 * Apply placeholders to the consent link template
 *
 * @param template
 * @param name
 * @param email
 * @returns
 */
function applyConsentLinkPlaceholders(template: string, name: string, email: string): string {
  return template.split('{NAME}').join(name).split('{EMAIL}').join(email);
}

const UserConsentPage = () => {
  const { t } = useTranslation('Onboarding');
  const { t: tHeader } = useTranslation('HeaderPanel');
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [loadingDocusignIframe, setLoadingDocusignIframe] = useState(true);
  const [consentIframeSrc, setConsentIframeSrc] = useState('about:blank');
  const userMenuRef = useRef<HTMLDivElement>(null);
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
        setCurrentUser(user);
        return tenantRepository
          .GetTenantInfo()
          .then(tenantRes => tenantRes.data)
          .catch(() => undefined)
          .then(tenantData => {
            let iframeSrc = '';
            const link = tenantData?.onboardingConsentLink;
            if (link?.trim()) {
              iframeSrc = applyConsentLinkPlaceholders(link, user.name ?? '', user.email ?? '');
            }
            if (!iframeSrc.trim()) {
              iframeSrc = 'about:blank';
            }
            setConsentIframeSrc(iframeSrc);
            setLoadingDocusignIframe(true);
            document.title = `${t('Informed Consent')} - PACS AI`;
            setAuthReady(true);
          });
      })
      .catch(() => {
        logoutUser(navigate, tid);
      });
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const firstName = currentUser?.name?.trim()?.split(/\s+/)[0] || 'User';

  const handleSubmitConsent = () => {
    navigate('/');
  };

  if (!authReady) {
    return <div className="min-h-screen bg-[#151815]" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#151815]">
      <header className="flex shrink-0 items-center justify-between px-6 py-5 sm:px-10">
        <Logo class="h-auto w-[120px] sm:w-[135px]" />
        <div
          className="relative flex items-center"
          ref={userMenuRef}
        >
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(open => !open)}
            className="inline-flex items-center rounded-lg bg-transparent px-5 py-2.5 text-center text-sm font-medium text-white !ring-0"
          >
            <span className="text-common-light mr-3 text-lg">
              {tHeader('Hi')}, {firstName}
            </span>
            <img
              src={chevronDownIcon}
              alt=""
              className="w-5"
            />
          </button>

          {isUserMenuOpen && (
            <div
              className="min-w-28 absolute right-0 z-50 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
              style={{ top: userMenuRef.current ? userMenuRef.current.offsetHeight : 0 }}
            >
              <ul className="py-2 text-sm text-white">
                <li>
                  <button
                    type="button"
                    className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/settings');
                    }}
                  >
                    {tHeader('Settings')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logoutUser(navigate, tenantId, false);
                    }}
                  >
                    {tHeader('Logout')}
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 pb-10 sm:px-10">
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

        <div className="mt-10 flex min-h-0 w-full flex-1 flex-col items-center sm:mt-14">
          <iframe
            title="DocuSign consent form"
            src={consentIframeSrc}
            className="w-full max-w-full shrink-0 rounded-lg border-0 bg-white"
            width="100%"
            height={loadingDocusignIframe ? 100 : 800}
            style={{ border: 'none' }}
            onLoad={() => setLoadingDocusignIframe(false)}
          />
          <Button
            className="mt-6 h-[51px] w-full shrink-0 rounded-lg !px-0 sm:max-w-[350px]"
            onClick={handleSubmitConsent}
          >
            {t('Submit Consent')}
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
