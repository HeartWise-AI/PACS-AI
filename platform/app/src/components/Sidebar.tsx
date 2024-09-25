import React, { useState, useEffect, useContext } from 'react';
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
import drawerLeftArrow from './../assets/pacs/icons/align-from-left-gradient.png';
import studiesActiveIcon from './../assets/pacs/icons/studies-active.png';
import studiesInActiveIcon from './../assets/pacs/icons/studies-inactive.png';
import aiModelsActiveIcon from './../assets/pacs/icons/ai-models-active.png';
import aiModelsInActiveIcon from './../assets/pacs/icons/ai-models-inactive.png';
import aiPredictionsInActiveIcon from './../assets/pacs/icons/ai-predictions-inactive.png';
import comingSoonImg from './../assets/pacs/icons/coming-soon.png';
import newTabActiveIcon from './../assets/pacs/icons/new-tab-active.png';

const Sidebar = () => {
  const [sidebarMini, setSidebarMini] = useState<boolean>(() => {
    const width = window.innerWidth;
    return width <= 1024;
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [apiInfo, setAPIInfo] = useState<Partial<GetAPIInfoResponse>>({});
  const { t } = useTranslation('Sidebar');
  const navigate = useNavigate();
  const frontendVersion = useContext(FrontendVersionContext);
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

  const handleMinimizeSidebarClick = () => {
    setSidebarMini(prevSidebarMini => !prevSidebarMini);
  };

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
                sidebarMini ? 'mx-auto mt-4 block rotate-180' : ''
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
                  sidebarMini ? 'mx-auto block py-2' : 'p-2'
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

                {!sidebarMini && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium  ${
                      isPageActive(`/`) || isPageActive(`/viewer`) || isPageActive(`/segmentation`)
                        ? 'text-black'
                        : 'text-white text-opacity-50'
                    }`}
                  >
                    {t('Studies')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className={`my-2 rounded-lg ${sidebarMini && 'flex justify-center'}`}
              style={{
                background: isPageActive(`/ai-models`)
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/ai-models`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'py-2 px-3' : 'p-2'
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
                {!sidebarMini && (
                  <Typography
                    variant="body"
                    className={`ms-3 ml-2 font-medium  ${
                      isPageActive(`/ai-models`) ? 'text-black' : 'text-white text-opacity-50'
                    }`}
                  >
                    {t('AI Models')}
                  </Typography>
                )}
              </a>
            </li>
            <li
              className={`my-2 rounded-lg ${sidebarMini && 'flex justify-center'}`}
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
                  sidebarMini ? 'py-2 px-3' : 'p-2'
                }`}
              >
                <img
                  src={aiPredictionsInActiveIcon}
                  alt="AI Predictions icon"
                  className="w-[18px]"
                />
                {!sidebarMini && (
                  <div className="items-enter flex gap-2">
                    <Typography
                      variant="body"
                      className={`ms-3 ml-2 font-medium  ${
                        location.pathname === '/ai-predictions'
                          ? 'text-black'
                          : 'text-white text-opacity-50'
                      }`}
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
                    sidebarMini ? 'justify-center' : 'justify-between'
                  }`}
                >
                  {!sidebarMini && (
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
            className={`${
              sidebarMini ? 'hidden' : 'block'
            } mt-4 flex w-full flex-col gap-3 rounded-lg border border-white border-opacity-10 p-4`}
          >
            <div className="flex items-center gap-2">
              <Typography
                variant="body"
                className="text-white text-opacity-50"
              >
                {t('Backend')}:
              </Typography>
              <Typography
                variant="body"
                className="text-white"
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
