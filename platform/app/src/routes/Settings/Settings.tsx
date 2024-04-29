import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SidebarAdmin, Sidebar, Typography } from '@ohif/ui';
import HeaderPanel from '/components/HeaderPanel';
import copyIcon from './../../assets/pacs/icons/copy-gradient.png';
import chevronDown from './../../assets/pacs/icons/chevron-down.png';

const SettingsPage = () => {
  const { t } = useTranslation();

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815] ">
        <Sidebar />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Settings" />
          <div className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <div className="">
              <h1 className="text-2xl text-white">{t('General Settings')}</h1>
            </div>
            <div className="flex items-center pt-7">
              {/* <img
                src="https://api.dicebear.com/7.x/identicon/svg?seed=123123"
                alt="Profile"
                width="55"
                className="rounded-lg border border-gray-200 p-2"
              /> */}
              <div className="h-10 w-10 rounded-lg bg-white opacity-10"></div>
              <div className="ml-3">
                <h1 className="text-lg font-normal text-white">Juan Dela Cruz</h1>
                <div className="-mt-1 flex flex-col text-sm font-light text-white text-opacity-70 sm:flex-row sm:items-center ">
                  <div className="text-left">abc123@gmail.com •</div>
                  <div className="flex items-center sm:ml-1">
                    0x1ABC7154748D1CE5144478CDEB574AE244B939B5
                    <button className="p-0 focus:ring-0">
                      <img
                        src={copyIcon}
                        alt="Copy icon"
                        className="ml-2 h-5 w-5 cursor-pointer"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-7">
              <h1 className="text-lg font-normal text-white">{t('Security')}</h1>

              <div className="mt-2 flex items-center justify-between border-b border-white border-opacity-10 pb-5">
                <div>
                  <h2 className="text-base font-light text-white">{t('Change Password')}</h2>
                  <h2 className="text-sm text-white text-opacity-70">
                    {t('Change your current password')}
                  </h2>
                </div>
                <button className="text-primary focus:ring-0">
                  <span className="relative z-10 bg-gradient-to-r from-[rgba(200,244,105,1)] to-[rgba(25,154,95,1)] bg-clip-text text-lg font-bold text-transparent">
                    {t('Change Password')}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-5">
              <h1 className="text-lg font-normal text-white">{t('Preferences')}</h1>

              <div className="mt-2 flex items-center justify-between pb-5">
                <div>
                  <h2 className="text-base font-light text-white">{t('Language')}</h2>
                  <h2 className="text-sm text-white text-opacity-70">
                    {t('Change your preferred language')}
                  </h2>
                </div>
                <button className="flex h-[45px] w-[200px] items-center justify-between rounded-lg bg-white bg-opacity-10 px-3 text-lg font-light text-white">
                  <span> {t('English')}</span>
                  <img
                    src={chevronDown}
                    alt="Chevron down icon"
                    className="h-5 w-5"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
