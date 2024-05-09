import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ButtonGradient, Typography, Logo } from '@ohif/ui';
import userRepository from '../api/userRepository';
import tenantRepository from '../api/tenantRepository';
import { UserRole } from '../api/userDTO';
import { GetTenantInfoResponse } from '../api/tenantDTO';
import logoIcon from './../assets/pacs/logo/pacs-ai-icon-logo.png';
import drawerLeftArrow from './../assets/pacs/icons/align-from-left-gradient.png';
import membersActiveIcon from './../assets/pacs/icons/members-active.png';
import membersInActiveIcon from './../assets/pacs/icons/members-inactive.png';
import kibanaLogsActiveIcon from './../assets/pacs/icons/kibana-logs-active.png';
import kibanaLogsInActiveIcon from './../assets/pacs/icons/kibana-logs-inactive.png';
import workplaceSettingsInActiveIcon from './../assets/pacs/icons/settings-inactive.png';
import workplaceSettingsActiveIcon from './../assets/pacs/icons/settings-active.png';
import newTabActiveIcon from './../assets/pacs/icons/new-tab-active.png';

const SidebarAdmin = () => {
  const [sidebarMini, setSidebarMini] = useState<boolean>(() => {
    const width = window.innerWidth;
    return width <= 1024;
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
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
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantRepository.GetTenantInfo();
        setTenantInfo(response.data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchCurrentUser();
    fetchTenantInfo();
  }, [userRepository, tenantRepository]);

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
        sidebarMini ? 'min-w-[110px]' : 'min-w-[350px]'
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
                sidebarMini ? 'mx-auto mt-4 rotate-180' : ''
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
              {tenantInfo.name ? `${tenantInfo.name} (${tenantInfo.id})` : '‎'}
            </Typography>
          )}
          <ul className="mt-5 space-y-2 font-medium">
            <li
              className={`my-2 rounded-lg ${sidebarMini && 'flex justify-center'}`}
              style={{
                background: isPageActive('/admin/members')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/admin/members`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'mx-auto block py-2' : 'p-2'
                }`}
              >
                {isPageActive('/admin/members') && (
                  <img
                    src={membersActiveIcon}
                    alt="Members icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive('/admin/members') && (
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
                      isPageActive('/admin/members') ? 'text-black' : 'text-white text-opacity-50'
                    }`}
                  >
                    {t('Members')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className={`my-2 rounded-lg ${sidebarMini && 'flex justify-center'}`}
              style={{
                background: isPageActive('/admin/kibana-logs')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/admin/kibana-logs`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'mx-auto block py-2' : 'p-2'
                }`}
              >
                {isPageActive('/admin/kibana-logs') && (
                  <img
                    src={kibanaLogsActiveIcon}
                    alt="Kibana logs icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive('/admin/kibana-logs') && (
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
                      isPageActive('/admin/kibana-logs')
                        ? 'text-black'
                        : 'text-white text-opacity-50'
                    }`}
                  >
                    {t('Kibana Logs')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className={`my-2 rounded-lg ${sidebarMini && 'flex justify-center'}`}
              style={{
                background: isPageActive('/admin/workspace-settings')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/admin/workspace-settings`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'mx-auto block py-2' : 'p-2'
                }`}
              >
                {isPageActive('/admin/workspace-settings') && (
                  <img
                    src={workplaceSettingsActiveIcon}
                    alt="Cogs icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive('/admin/workspace-settings') && (
                  <img
                    src={workplaceSettingsInActiveIcon}
                    alt="Cogs icon"
                    className="w-[18px]"
                  />
                )}

                {!sidebarMini && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium  ${
                      isPageActive('/admin/workspace-settings')
                        ? 'text-black'
                        : 'text-white text-opacity-50'
                    }`}
                  >
                    {t('Workspace Settings')}
                  </Typography>
                )}
              </a>
            </li>
          </ul>
        </div>
        {(role === UserRole.OWNER || role === UserRole.ADMIN) && (
          <ButtonGradient
            className="h-[47px] w-full !px-0"
            onClick={() => navigate(`/`)}
          >
            <div
              className={`flex items-center ${
                sidebarMini ? 'justify-center' : 'justify-between px-3'
              }`}
            >
              {!sidebarMini && (
                <div className="!text-primary-dark font-light">{'Launch PACS AI'}</div>
              )}
              <img
                src={newTabActiveIcon}
                alt="New tab icon"
              />
            </div>
          </ButtonGradient>
        )}
      </div>
    </aside>
  );
};

export default SidebarAdmin;
