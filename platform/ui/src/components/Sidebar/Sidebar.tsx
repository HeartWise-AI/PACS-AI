import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Typography, Logo } from '@ohif/ui';
import logoIcon from './../../assets/pacs/logo/pacs-ai-icon-logo.png';
import drawerLeftArrow from './../../assets/pacs/icons/align-from-left-gradient.png';
import studiesActiveIcon from './../../assets/pacs/icons/studies-active.png';
import studiesInActiveIcon from './../../assets/pacs/icons/studies-inactive.png';
import aiModelsActiveIcon from './../../assets/pacs/icons/ai-models-active.png';
import aiModelsInActiveIcon from './../../assets/pacs/icons/ai-models-inactive.png';
import aiPredictionsInActiveIcon from './../../assets/pacs/icons/ai-predictions-inactive.png';
import comingSoonImg from './../../assets/pacs/icons/coming-soon.png';

const Sidebar = () => {
  const [sidebarMini, setSidebarMini] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  let { tenantId } = useParams();

  const handleMinimizeSidebarClick = () => {
    setSidebarMini(prevSidebarMini => !prevSidebarMini);
  };

  // Check if pathname is active
  const isPageActive = pattern => {
    const pathname = window.location.pathname;
    return pathname === pattern;
  };
  return (
    <aside
      id="default-sidebar"
      className={`sticky top-0 left-0 z-40 h-screen ${
        sidebarMini ? 'min-w-[80px]' : 'min-w-[350px]'
      } p-5`}
      aria-label="Sidebar"
    >
      <div className="border-1 h-full overflow-y-auto rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] px-3 py-4 backdrop-blur-lg">
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
              {t('PACS AI (1234567890-00)')}
            </Typography>
          )}
          <ul className="mt-5 space-y-2 font-medium">
            <li
              className={`my-2 rounded-lg ${sidebarMini && 'flex justify-center'}`}
              style={{
                background:
                  isPageActive(`/${tenantId}`) ||
                  isPageActive(`/${tenantId}/viewer`) ||
                  isPageActive(`/${tenantId}/segmentation`)
                    ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                    : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/${tenantId}`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'mx-auto block py-2' : 'p-2'
                }`}
              >
                {(isPageActive(`/${tenantId}`) ||
                  isPageActive(`/${tenantId}/viewer`) ||
                  isPageActive(`/${tenantId}/segmentation`)) && (
                  <img
                    src={studiesActiveIcon}
                    alt="Studies icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive(`/${tenantId}`) &&
                  !isPageActive(`/${tenantId}/viewer`) &&
                  !isPageActive(`/${tenantId}/segmentation`) && (
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
                      isPageActive(`/${tenantId}`) ||
                      isPageActive(`/${tenantId}/viewer`) ||
                      isPageActive(`/${tenantId}/segmentation`)
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
                background: isPageActive(`/${tenantId}/ai-models`)
                  ? 'linear-gradient(98.05deg, #C8F469 21.15%, #05905E 100%)'
                  : undefined,
              }}
            >
              <a
                onClick={() => navigate(`/${tenantId}/ai-models`)}
                className={`group flex cursor-pointer items-center rounded-lg hover:bg-green-100 hover:bg-opacity-10 ${
                  sidebarMini ? 'py-2 px-3' : 'p-2'
                }`}
              >
                {isPageActive(`/${tenantId}/ai-models`) && (
                  <img
                    src={aiModelsActiveIcon}
                    alt="AI Models icon"
                    className="w-[18px]"
                  />
                )}
                {!isPageActive(`/${tenantId}/ai-models`) && (
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
                      isPageActive(`/${tenantId}/ai-models`)
                        ? 'text-black'
                        : 'text-white text-opacity-50'
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
      </div>
    </aside>
  );
};

export default Sidebar;
