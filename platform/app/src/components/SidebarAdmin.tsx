import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { ButtonGradient, Typography, Logo } from '@ohif/ui';
import userRepository from '../api/userRepository';
import logoIcon from './../assets/pacs/logo/pacs-ai-icon-logo.png';
import drawerLeftArrow from './../assets/pacs/icons/align-from-left-gradient.png';
import membersActiveIcon from './../assets/pacs/icons/members-active.png';
import membersInActiveIcon from './../assets/pacs/icons/members-inactive.png';
import kibanaLogsActiveIcon from './../assets/pacs/icons/kibana-logs-active.png';
import kibanaLogsInActiveIcon from './../assets/pacs/icons/kibana-logs-inactive.png';
import workplaceSettingsInActiveIcon from './../assets/pacs/icons/settings-inactive.png';

const SidebarAdmin = () => {
  const [sidebarMini, setSidebarMini] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  let role = '';

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await userRepository.GetCurrentUser();
        setCurrentUser(response.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchCurrentUser();
  }, [userRepository]);

  const handleMinimizeSidebarClick = () => {
    setSidebarMini(prevSidebarMini => !prevSidebarMini);
  };

  // Check if pathname is active
  const isPageActive = pattern => {
    const pathname = window.location.pathname;
    return pathname === pattern;
  };

  if (currentUser) {
    role = currentUser.role;
  }
  return (
    <aside
      id="default-sidebar"
      className={`sticky top-0 left-0 z-40 h-screen ${
        sidebarMini ? 'min-w-[80px]' : 'min-w-[350px]'
      } p-5`}
      aria-label="Sidebar"
    >
      <div className="border-1 flex h-full flex-col justify-between overflow-y-auto rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] px-3 py-4 backdrop-blur-lg">
        <div>
          <div
            className={`flex items-start justify-between ${
              sidebarMini ? 'ml-1 flex-col' : 'flex-row'
            }`}
          >
            {sidebarMini && (
              <img
                src={logoIcon}
                alt="Pacs logo"
                className="w-[46px]"
              />
            )}
            {!sidebarMini && <Logo class="h-auto w-[117px]" />}
            <button
              className={`flex h-7 w-7 items-center justify-center rounded-md bg-white bg-opacity-10 ${
                sidebarMini ? 'ml-1 mt-4 rotate-180' : ''
              }`}
              onClick={handleMinimizeSidebarClick}
            >
              <img
                src={drawerLeftArrow}
                alt="Left arrow"
                className="w-[80%]"
              />
            </button>
          </div>
          {!sidebarMini && (
            <Typography
              variant="caption"
              className="mt-7 text-white text-opacity-90"
            >
              {t('PACS AI (1234567890-00)')}
            </Typography>
          )}
          <ul className="mt-5 space-y-2 font-medium">
            <li
              className="my-2 rounded-lg"
              style={{
                background: isPageActive('/members')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/members`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'py-2 px-3' : 'p-2'
                }`}
              >
                {isPageActive('/members') && (
                  <img
                    src={membersActiveIcon}
                    alt="Members icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive('/members') && (
                  <img
                    src={membersInActiveIcon}
                    alt="Members icon"
                    className="w-[18px]"
                  />
                )}

                {!sidebarMini && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium  ${
                      isPageActive('/members') ? 'text-black' : 'text-white text-opacity-50'
                    }`}
                  >
                    {t('Members')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className="my-2 rounded-lg"
              style={{
                background: isPageActive('/kibana-logs')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/kibana-logs`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'py-2 px-3' : 'p-2'
                }`}
              >
                {isPageActive('/kibana-logs') && (
                  <img
                    src={kibanaLogsActiveIcon}
                    alt="Kibana logs icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive('/kibana-logs') && (
                  <img
                    src={kibanaLogsInActiveIcon}
                    alt="Kibana logs icon"
                    className="w-[18px]"
                  />
                )}

                {!sidebarMini && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium  ${
                      isPageActive('/kibana-logs') ? 'text-black' : 'text-white text-opacity-50'
                    }`}
                  >
                    {t('Kibana Logs')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className="my-2 rounded-lg"
              style={{
                background: isPageActive('/workspace-settings')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/workspace-settings`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'py-2 px-3' : 'p-2'
                }`}
              >
                {isPageActive('/workspace-settings') && (
                  <img
                    src={workplaceSettingsInActiveIcon}
                    alt="Cogs icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive('/workspace-settings') && (
                  <img
                    src={workplaceSettingsInActiveIcon}
                    alt="Cogs icon"
                    className="w-[18px]"
                  />
                )}

                {!sidebarMini && (
                  <div className="items-enter flex gap-2">
                    <Typography
                      variant="body"
                      className={`ms-3 ml-2 font-medium  ${
                        isPageActive('/workspace-settings')
                          ? 'text-black'
                          : 'text-white text-opacity-50'
                      }`}
                    >
                      {t('Workspace Settings')}
                    </Typography>
                  </div>
                )}
              </a>
            </li>
          </ul>
        </div>
        {(role === 'OWNER' || role === 'ADMIN') && (
          <ButtonGradient
            className="h-[47px] w-full !px-0"
            onClick={() => navigate(`/`)}
          >
            {'Launch PACS AI'}
          </ButtonGradient>
        )}
      </div>
    </aside>
  );
};

export default SidebarAdmin;
