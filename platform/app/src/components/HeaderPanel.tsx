import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { Typography } from '@ohif/ui';
import userRepository from '../api/userRepository';
import tenantRepository from '../api/tenantRepository';
import { logoutUser } from '../service/userService';
import chevronRightIcon from './../assets/pacs/icons/chevron-right.png';
import chevronDownIcon from './../assets/pacs/icons/chevron-down.png';

const HeaderPanel = ({ title }) => {
  const { t } = useTranslation('HeaderPanel');
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const tenantId = localStorage.getItem('tenantId') || '';
  let name: string = 'User';

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await userRepository.GetCurrentUser();
        setCurrentUser(response.data);
        // if user has not signed consent, redirect to consent page
        if (!response.data.isConsentSigned && !location.pathname.includes('/user/consent')) {
          let consentRequired = true;
          try {
            const tenantResponse = await tenantRepository.GetTenantInfo();
            if (tenantResponse.data.onboardingEnableConsent === false) {
              consentRequired = false;
            }
          } catch {
            // if tenant settings cannot be loaded, keep default (redirect) for safety
          }
          if (consentRequired) {
            navigate('/user/consent', { replace: true });
          }
        }
      } catch (error) {
        logoutUser(navigate, tenantId);
      }
    };

    fetchCurrentUser();
  }, [navigate, location.pathname, tenantId, userRepository]);

  if (currentUser) {
    name = currentUser.name.split(' ')[0];
  }

  const handleBackButtonClick = () => {
    const searchParams = new URLSearchParams(window.location.search);

    // remove the StudyInstanceUIDs parameter
    searchParams.delete('StudyInstanceUIDs');

    // navigate back to the main page with the retained search parameters
    navigate(`/?${searchParams.toString()}`);
  };
  return (
    <div className="relative mx-auto w-full pt-5">
      <div className="mb-1 flex h-full flex-row items-center justify-between">
        <div className="flex-col gap-3">
          <Typography
            variant="h6"
            className="text-white"
          >
            {t(`${title}`)}
          </Typography>
          {(location.pathname.includes('/viewer') ||
            location.pathname.includes('/segmentation')) && (
            <nav className="flex">
              <ol className="inline-flex items-center space-x-1 rtl:space-x-reverse md:space-x-2">
                <li className="inline-flex items-center">
                  <a
                    onClick={() => handleBackButtonClick()}
                    className="text-primary-dark inline-flex cursor-pointer items-center text-sm font-light"
                  >
                    {t('Studies')}
                  </a>
                </li>
                <li>
                  <div className="flex items-center">
                    <img
                      src={chevronRightIcon}
                      alt="Chevron right icon"
                      className="h-auto w-4"
                    />
                    <a
                      href="#"
                      className="ml-2 text-sm font-light text-white text-opacity-70"
                    >
                      {location.pathname.split('?')[0].includes('/viewer')
                        ? t('Viewer')
                        : t('Segmentation')}
                    </a>
                  </div>
                </li>
              </ol>
            </nav>
          )}
        </div>
        <div className="flex flex-row">
          <div
            className="relative flex items-center"
            ref={ref}
          >
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center rounded-lg bg-transparent px-5 py-2.5 text-center text-sm font-medium text-white !ring-0"
              type="button"
            >
              <span className="text-common-light mr-3 text-lg">
                {t('Hi')}, {name}
              </span>
              <img
                src={chevronDownIcon}
                alt="Chevron down icon"
                className="w-5"
              />
            </button>

            {isOpen && (
              <div
                className="min-w-28 absolute z-50 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
                style={{ top: ref.current ? ref.current.offsetHeight : 0 }}
              >
                <ul className="py-2 text-sm text-white">
                  <li>
                    <a
                      className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                      onClick={() => navigate(`/settings`)}
                    >
                      {t('Settings')}
                    </a>
                  </li>
                  <li>
                    <a
                      className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                      onClick={() => {
                        logoutUser(navigate, tenantId, false);
                      }}
                    >
                      {t('Logout')}
                    </a>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderPanel;
