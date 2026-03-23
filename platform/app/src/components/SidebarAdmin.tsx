import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ButtonGradient, Typography, Logo } from '@ohif/ui';
import userRepository from '../api/userRepository';
import tenantRepository from '../api/tenantRepository';
import repository from '../api/repository';
import { UserRole } from '../api/userDTO';
import { GetTenantInfoResponse } from '../api/tenantDTO';
import { GetAPIInfoResponse } from '../api/dto';
import { FrontendVersionContext } from '../App';
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showExpandedContent, setShowExpandedContent] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [apiInfo, setAPIInfo] = useState<Partial<GetAPIInfoResponse>>({});
  const { t } = useTranslation('Sidebar');
  const navigate = useNavigate();
  const frontendVersion = useContext(FrontendVersionContext);
  let role = '';

  const expandSidebar = useCallback(() => {
    setSidebarExpanded(true);
  }, []);

  const collapseSidebar = useCallback(() => {
    setSidebarExpanded(false);
    setShowExpandedContent(false);
  }, []);

  useEffect(() => {
    let timeoutId;
    if (sidebarExpanded) {
      timeoutId = setTimeout(() => setShowExpandedContent(true), 200); // Adjust delay as needed
    } else {
      setShowExpandedContent(false);
    }
    return () => clearTimeout(timeoutId);
  }, [sidebarExpanded]);

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
    const fetchAPIInfo = async () => {
      try {
        const response = await repository.GetAPIInfo();
        setAPIInfo(response.data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchCurrentUser();
    fetchTenantInfo();
    fetchAPIInfo();
  }, [userRepository, tenantRepository]);

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
      className={`sticky top-0 left-0 z-40 h-screen !overflow-x-hidden !transition-all !duration-300 ${
        sidebarExpanded ? 'min-w-[280px]' : 'min-w-[110px]'
      } p-5`}
      aria-label="Sidebar"
      onMouseEnter={expandSidebar}
      onMouseLeave={collapseSidebar}
    >
      <div className="border-1 flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] px-3 py-4 backdrop-blur-lg">
        <div>
          <div className="h-[58px]">
            <div className="flex items-start justify-between">
              {sidebarExpanded ? (
                <Logo class="h-[30px] w-auto" />
              ) : (
                <img
                  src={logoIcon}
                  alt="Pacs logo"
                  className="w-[46px]"
                />
              )}
            </div>
            {showExpandedContent && (
              <div className="flex flex-col">
                <Typography
                  variant="caption"
                  className="mt-1 text-white text-opacity-90 transition-all delay-150 duration-300"
                  component="span"
                >
                  {tenantInfo.name ? `${tenantInfo.name}` : '‎'}
                </Typography>
                <Typography
                  variant="caption"
                  className="mt-1 text-white text-opacity-70 transition-all delay-150 duration-300"
                  component="span"
                >
                  {tenantInfo.name ? `${tenantInfo.id}` : '‎'}
                </Typography>
              </div>
            )}
          </div>
          <ul className="mt-5 space-y-2 font-medium">
            <li
              className={`my-2 rounded-lg ${!sidebarExpanded && 'flex justify-center'}`}
              style={{
                background: isPageActive('/admin/members')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/admin/members`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  !sidebarExpanded ? 'mx-auto block py-2' : 'p-2'
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

                {showExpandedContent && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium transition-opacity delay-150 duration-300 ${
                      isPageActive('/admin/members') ? 'text-black' : 'text-white text-opacity-50'
                    }`}
                    component="span"
                  >
                    {t('Members')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className={`my-2 rounded-lg ${!sidebarExpanded && 'flex justify-center'}`}
              style={{
                background: isPageActive('/admin/kibana-logs')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/admin/kibana-logs`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  !sidebarExpanded ? 'mx-auto block py-2' : 'p-2'
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

                {showExpandedContent && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium transition-opacity delay-150 duration-300 ${
                      isPageActive('/admin/kibana-logs')
                        ? 'text-black'
                        : 'text-white text-opacity-50'
                    }`}
                    component="span"
                  >
                    {t('Kibana Logs')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className={`my-2 rounded-lg ${!sidebarExpanded && 'flex justify-center'}`}
              style={{
                background: isPageActive('/admin/workspace-settings')
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/admin/workspace-settings`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  !sidebarExpanded ? 'mx-auto block py-2' : 'p-2'
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

                {showExpandedContent && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium transition-opacity delay-150 duration-300 ${
                      isPageActive('/admin/workspace-settings')
                        ? 'text-black'
                        : 'text-white text-opacity-50'
                    }`}
                    component="span"
                  >
                    {t('Workspace Settings')}
                  </Typography>
                )}
              </a>
            </li>
          </ul>
        </div>
        <div>
          {(role === UserRole.OWNER || role === UserRole.ADMIN) && (
            <ButtonGradient
              className="h-[47px] w-full !px-0"
              onClick={() => navigate(`/`)}
            >
              <div
                className={`flex items-center ${
                  showExpandedContent ? 'justify-center' : 'justify-between px-3'
                }`}
              >
                {showExpandedContent && (
                  <div className="!text-primary-dark font-light">{t('Launch PACS AI')}</div>
                )}
                <img
                  src={newTabActiveIcon}
                  alt="New tab icon"
                />
              </div>
            </ButtonGradient>
          )}
          <div
            className={`transition-all duration-300 ${
              showExpandedContent ? 'block' : 'hidden'
            } mt-4 flex w-full flex-col gap-3 rounded-lg border border-white border-opacity-10 p-4`}
          >
            <div className="flex items-center gap-2">
              <Typography
                variant="body"
                className="text-white text-opacity-50"
                component="span"
              >
                {t('Backend')}:
              </Typography>
              <Typography
                variant="body"
                className="text-white"
                component="span"
              >
                {apiInfo.version}
              </Typography>
            </div>
            <div className="flex items-center gap-2">
              <Typography
                variant="body"
                className="text-white text-opacity-50"
                component="span"
              >
                {t('Frontend')}:
              </Typography>
              <Typography
                variant="body"
                className="text-white"
                component="span"
              >
                {frontendVersion}
              </Typography>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SidebarAdmin;
