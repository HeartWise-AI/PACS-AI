import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ButtonGradient, Typography, Logo } from '@ohif/ui';
import userRepository from '../api/userRepository';
import tenantRepository from '../api/tenantRepository';
import repository from '../api/repository';
import { UserRole } from '../api/userDTO';
import { GetTenantInfoResponse } from '../api/tenantDTO';
import { GetAPIInfoResponse } from '../api/dto';
import { FrontendVersionContext } from '../App';
import logoIcon from './../assets/pacs/logo/pacs-ai-icon-logo.png';
import studiesActiveIcon from './../assets/pacs/icons/studies-active.png';
import studiesInActiveIcon from './../assets/pacs/icons/studies-inactive.png';
import aiModelsActiveIcon from './../assets/pacs/icons/ai-models-active.png';
import aiModelsInActiveIcon from './../assets/pacs/icons/ai-models-inactive.png';
import aiPredictionsInActiveIcon from './../assets/pacs/icons/ai-predictions-inactive.png';
import comingSoonImg from './../assets/pacs/icons/coming-soon.png';
import newTabActiveIcon from './../assets/pacs/icons/new-tab-active.png';

const Sidebar = () => {
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
    let timeoutId: NodeJS.Timeout;
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

  // Handle navigation to studies page
  const handleNavigateStudiesPage = () => {
    const pathname = window.location.pathname;

    if (pathname === '/viewer' || pathname === '/segmentation') {
      const searchParams = new URLSearchParams(window.location.search);

      // remove the StudyInstanceUIDs parameter
      searchParams.delete('StudyInstanceUIDs');

      // navigate back to the main page with the retained search parameters
      navigate(`/?${searchParams.toString()}`);
    } else {
      // navigate to route '/'
      navigate('/');
    }
  };

  if (currentUser) {
    role = currentUser.role;
  }

  return (
    <aside
      id="default-sidebar"
      className={`relative sticky top-0 left-0 z-40 h-screen !overflow-x-hidden !transition-all !duration-300 ${
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
                background:
                  isPageActive(`/`) || isPageActive(`/viewer`) || isPageActive(`/segmentation`)
                    ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                    : undefined,
              }}
            >
              <a
                onClick={() => {
                  handleNavigateStudiesPage();
                }}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  !sidebarExpanded ? 'mx-auto block py-2' : 'p-2'
                }`}
              >
                {(isPageActive(`/`) ||
                  isPageActive(`/viewer`) ||
                  isPageActive(`/segmentation`)) && (
                  <img
                    src={studiesActiveIcon}
                    alt="Studies icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive(`/`) &&
                  !isPageActive(`/viewer`) &&
                  !isPageActive(`/segmentation`) && (
                    <img
                      src={studiesInActiveIcon}
                      alt="Studies icon"
                      className="w-[18px]"
                    />
                  )}

                {showExpandedContent && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium ${
                      isPageActive(`/`) || isPageActive(`/viewer`) || isPageActive(`/segmentation`)
                        ? 'text-black'
                        : 'text-white text-opacity-50'
                    }`}
                    component="span"
                  >
                    {t('Studies')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className={`my-2 rounded-lg ${!sidebarExpanded && 'flex justify-center'}`}
              style={{
                background: isPageActive(`/ai-models`)
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/ai-models`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  !sidebarExpanded ? 'py-2 px-3' : 'p-2'
                }`}
              >
                {isPageActive(`/ai-models`) && (
                  <img
                    src={aiModelsActiveIcon}
                    alt="AI Models icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive(`/ai-models`) && (
                  <img
                    src={aiModelsInActiveIcon}
                    alt="AI Models icon"
                    className="w-[18px]"
                  />
                )}
                {showExpandedContent && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium ${
                      isPageActive(`/ai-models`) ? 'text-black' : 'text-white text-opacity-50'
                    }`}
                    component="span"
                  >
                    {t('AI Models')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className={`my-2 rounded-lg ${!sidebarExpanded && 'flex justify-center'}`}
              style={{
                background:
                  location.pathname === '/ai-predictions'
                    ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                    : undefined,
              }}
            >
              <a
                href="#"
                className={`group flex items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  !sidebarExpanded ? 'py-2 px-3' : 'p-2'
                }`}
              >
                <img
                  src={aiPredictionsInActiveIcon}
                  alt="AI Predictions icon"
                  className="w-[18px]"
                />
                {showExpandedContent && (
                  <div className="items-enter flex gap-2">
                    <Typography
                      variant="body"
                      className={`ms-3 ml-2 font-medium ${
                        location.pathname === '/ai-predictions'
                          ? 'text-black'
                          : 'text-white text-opacity-50'
                      }`}
                      component="span"
                    >
                      {t('AI Predictions')}
                    </Typography>
                    <img
                      src={comingSoonImg}
                      alt="AI Predictions icon"
                      className="h-[17px] w-auto"
                    />
                  </div>
                )}
              </a>
            </li>
          </ul>
        </div>
        <div>
          {(role === UserRole.OWNER || role === UserRole.ADMIN) && (
            <Link
              to="/admin/members"
              target="_blank"
            >
              <ButtonGradient className="h-[47px] w-full !px-0">
                <div
                  className={`flex items-center px-3 ${
                    !sidebarExpanded ? 'justify-center' : 'justify-between'
                  }`}
                >
                  {showExpandedContent && (
                    <div className="!text-primary-dark font-light"> {t('Admin Console')}</div>
                  )}
                  <img
                    src={newTabActiveIcon}
                    alt="New tab icon"
                  />
                </div>
              </ButtonGradient>
            </Link>
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

export default Sidebar;
